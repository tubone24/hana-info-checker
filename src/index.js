import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../data/news.json');
const NEWS_URL = 'https://hana.b-rave.tokyo/news/';

const isDryRun = process.argv.includes('--dry-run');

async function loadExistingNews() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { news: [], lastChecked: null };
  }
}

async function saveNews(newsData) {
  await fs.writeFile(DATA_FILE, JSON.stringify(newsData, null, 2), 'utf-8');
}

async function fetchNews() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log(`Fetching news from ${NEWS_URL}...`);
    await page.goto(NEWS_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // ページが完全に読み込まれるまで少し待機
    await page.waitForTimeout(2000);

    // ニュース一覧を取得
    const newsItems = await page.evaluate(() => {
      const items = [];
      const newsElements = document.querySelectorAll('.items-item');

      newsElements.forEach((el) => {
        const link = el.querySelector('a');
        const dateSpan = el.querySelector('.item-date span:first-child');
        const categorySpan = el.querySelector('.item-date span:last-child');
        const titleEl = el.querySelector('.item-title p');

        const url = link?.href || '';
        const date = dateSpan?.textContent?.trim() || '';
        const category = categorySpan?.textContent?.trim() || '';
        const title = titleEl?.textContent?.trim() || '';

        if (title && url) {
          items.push({
            title,
            url,
            date,
            category,
            id: url // URLをユニークIDとして使用
          });
        }
      });

      return items;
    });

    console.log(`Found ${newsItems.length} news items`);
    return newsItems;
  } finally {
    await browser.close();
  }
}

async function sendSlackNotification(newItems) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('SLACK_WEBHOOK_URL is not set. Skipping notification.');
    return;
  }

  for (const item of newItems) {
    const message = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'HANA 新着ニュース',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${item.title}*`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `${item.date || '日付なし'} | ${item.category || 'NEWS'}`
            }
          ]
        }
      ]
    };

    if (item.url) {
      message.blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '詳細を見る',
              emoji: true
            },
            url: item.url,
            action_id: 'view_news'
          }
        ]
      });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        console.error(`Failed to send Slack notification: ${response.status}`);
      } else {
        console.log(`Sent notification for: ${item.title}`);
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }
}

async function main() {
  console.log('=== Hana Info Checker ===');
  console.log(`Time: ${new Date().toISOString()}`);

  if (isDryRun) {
    console.log('Running in dry-run mode (no notifications will be sent)');
  }

  // 既存のニュースデータを読み込み
  const existingData = await loadExistingNews();
  const existingIds = new Set(existingData.news.map(n => n.id));

  // 最新のニュースを取得
  const currentNews = await fetchNews();

  if (currentNews.length === 0) {
    console.log('No news items found. The page structure may have changed.');
    return;
  }

  // 新しいニュースを検出
  const newItems = currentNews.filter(item => !existingIds.has(item.id));

  console.log(`New items found: ${newItems.length}`);

  if (newItems.length > 0) {
    console.log('New news items:');
    newItems.forEach(item => {
      console.log(`  - ${item.date}: ${item.title}`);
    });

    // Slackに通知（dry-runでない場合）
    if (!isDryRun) {
      await sendSlackNotification(newItems);
    }
  } else {
    console.log('No new news items.');
  }

  // データを保存
  const updatedData = {
    news: currentNews,
    lastChecked: new Date().toISOString()
  };

  await saveNews(updatedData);
  console.log('News data saved to data/news.json');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
