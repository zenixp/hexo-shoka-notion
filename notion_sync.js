const dotenv = require('dotenv');
const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md')
const fs = require('fs');
const path = require('path');
const https = require('https');
const { mkdirp } = require('mkdirp');

dotenv.config();
const postDir = 'source/_posts'
const assetsDir = 'source/assets'
const assetsPrefix = 'assets';
const dbFile = 'notion_db.json';

const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

const n2m = new NotionToMarkdown({ notionClient: notion });

// 读取数据库文件
function readDb() {
    try {
        if (fs.existsSync(dbFile)) {
            const data = fs.readFileSync(dbFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取数据库文件失败:', error);
    }
    return {};
}

// 写入数据库文件
function writeDb(db) {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
    } catch (error) {
        console.error('写入数据库文件失败:', error);
    }
}

// 删除目录及其内容
function deleteDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

async function syncNotionToHexo() {
    try {
        // 读取数据库
        const db = readDb();

        // 1. 获取文章列表
        const response = await notion.dataSources.query({
            data_source_id: process.env.NOTION_DATA_SOURCE,
            filter: {
                property: 'Published',
                checkbox: {
                    equals: true
                }
            }
        });

        console.log(JSON.stringify(response));

        if (!response.results || response.results.length === 0) {
            console.log('没有找到已发布的文章');
            return;
        }

        // 收集当前Notion中的文章ID
        const currentPostIds = new Set();
        
        // 2. 处理每篇文章
        for (const post of response.results) {
            try {
                // 获取标题和最后编辑时间
                const title = post.properties.Title?.title[0]?.plain_text || 'Untitled';
                const lastEditedTime = post.last_edited_time;
                const postId = post.id;
                
                // 添加到当前文章ID集合
                currentPostIds.add(postId);

                console.log(`处理文章: ${title}`);
                console.log(`最后编辑时间: ${lastEditedTime}`);

                // 检查数据库中是否有记录
                const dbRecord = db[postId];

                // 如果数据库中有记录且最后编辑时间没有变化，则跳过
                if (dbRecord && dbRecord.lastEditedTime === lastEditedTime) {
                    console.log(`文章 ${title} 未发生变化，跳过处理`);
                    continue;
                }

                console.log(`文章 ${title} 需要更新`);

                // 如果是更新操作，先删除旧的图片目录
                if (dbRecord) {
                    const oldAssetsPostDir = path.join(assetsDir, postId);
                    deleteDir(oldAssetsPostDir);
                    console.log(`已删除旧的图片目录: ${oldAssetsPostDir}`);
                }

                // 获取创建时间
                const dateObj = post.properties.Date?.date?.start
                    ? new Date(post.properties.Date.date.start)
                    : new Date();

                // 提取Tags和Categories
                const tags = extractTags(post);
                const categories = extractCategories(post);

                const assetsPostDir = path.join(assetsDir, postId);
                await mkdirp(assetsPostDir);

                let cover = '';
                if (post.properties.Cover?.files?.length) {
                    const coverName = Date.now() + '_' + post.properties.Cover.files[0].name
                    await downloadImage(post.properties.Cover.files[0].file.url, assetsPostDir, coverName)
                    cover = path.join(assetsPrefix, postId, coverName)
                }

                // 生成Markdown头部
                let content = `---
title: "${title}"
date: ${formatDate(dateObj, 'y-m-d')}
tags: ${formatTagsOrCategories(tags)}
categories: ${formatTagsOrCategories(categories)}
cover: ${cover}
---\n\n`;

                const blocks = await notion.blocks.children.list({
                    block_id: postId
                });
                const mdBlocks = await n2m.blocksToMarkdown(blocks.results)
                const mdStringObj = n2m.toMarkdownString(mdBlocks);

                const mdString = await dealMdImage(mdStringObj.parent, postId);

                content += mdString;

                // 写入Markdown文件
                const filePath = path.join(postDir, `${postId}.md`);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`成功生成: ${filePath}`);

                // 更新数据库记录
                db[postId] = {
                    lastEditedTime: lastEditedTime,
                    title: title
                };
                writeDb(db);
                console.log(`已更新数据库记录 for ${title}`);

            } catch (error) {
                console.error(`处理文章时出错`, error);
            }
        }
        
        // 3. 删除不在Notion中的文章
        console.log('检查需要删除的文章...');
        for (const postId in db) {
            if (!currentPostIds.has(postId)) {
                console.log(`删除本地文章: ${db[postId].title} (${postId})`);
                
                // 删除markdown文件
                const filePath = path.join(postDir, `${postId}.md`);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`已删除文件: ${filePath}`);
                }
                
                // 删除图片目录
                const assetsPostDir = path.join(assetsDir, postId);
                deleteDir(assetsPostDir);
                console.log(`已删除图片目录: ${assetsPostDir}`);
                
                // 从数据库中删除记录
                delete db[postId];
            }
        }
        writeDb(db);

        console.log('同步完成');
    } catch (error) {
        console.error(`同步失败`, error);
        process.exit(1);
    }
}

// 下载图片到指定目录
async function downloadImage(url, dir, fileName) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(dir, fileName);
        const file = fs.createWriteStream(filePath);

        https.get(url, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`下载图片失败，状态码: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve(fileName);
            });
        }).on('error', error => {
            fs.unlink(filePath, () => {});
            reject(error);
        });
    });
}

// 提取md中的图片并下载到本地后替换掉
const dealMdImage = async (mdString, postId) => {
    const regex = /!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)/g;
    const matches = [];
    let match;
    while ((match = regex.exec(mdString)) !== null) {
        matches.push({
            alt: match[1],
            url: match[2],
            title: match[3] || ''
        });
    }
    if (matches.length) {
        for (let match of matches) {
            if (match.url.startsWith('http')) {
                try {
                    const imgName = Date.now() + '_' + path.basename(new URL(match.url).pathname);
                    await downloadImage(match.url, path.join(assetsDir, postId), imgName)
                    mdString = mdString.replaceAll(match.url, path.join('/' + assetsPrefix, postId, imgName))
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }
    return mdString;
}

// 格式化时间
function formatDate(date, format) {
    if (!format) {
        format = 'ymd';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return format.replace('y', year).replace('m', month).replace('d', day);
}


// 提取Tags
function extractTags(post) {
    const tagProperty = post.properties.Tags;
    if (!tagProperty || tagProperty.type !== 'multi_select') {
        return [];
    }
    return tagProperty.multi_select.map(option => option.name);
}

// 提取Category
function extractCategories(post) {
    const categoryProperty = post.properties.Category;
    console.log(categoryProperty)
    if (!categoryProperty || categoryProperty.type !== 'select') {
        return [];
    }
    return categoryProperty.select ? [categoryProperty.select.name] : [];
}

// 格式化Tags或Categories为YAML数组格式
function formatTagsOrCategories(items) {
    if (!items || items.length === 0) {
        return '[]';
    }
    if (items.length === 1) {
        return `[${items[0]}]`;
    }
    return '[' + items.map(item => `"${item}"`).join(', ') + ']';
}

// 执行同步
syncNotionToHexo();
