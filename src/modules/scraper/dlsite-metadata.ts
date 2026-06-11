import * as cheerio from 'cheerio';
import { formatRjCode } from '../media/rj-code.js';

type DlsiteLanguageConfig = {
  cookieLocale: string;
  ageRatingsLabel: string;
  genreLabel: string;
  releaseLabel: string;
  seriesLabel: string;
  voiceActorLabel: string;
};

type WorkCircle = {
  id?: number | string;
  name?: string;
};

type WorkTag = {
  id: number | string;
  name: string;
};

type WorkVoiceActor = {
  id: string;
  name: string;
};

type WorkSeries = {
  id: number;
  name: string;
};

type StaticWorkMetadata = {
  id: number;
  title?: string;
  circle?: WorkCircle;
  nsfw?: boolean;
  release?: string;
  series?: WorkSeries;
  tags: WorkTag[];
  vas: WorkVoiceActor[];
};

type DynamicMetadataInput = {
  dl_count?: number | string;
  rate_average_2dp?: number;
  rate_count?: number;
  rate_count_detail?: unknown;
  review_count?: number;
  price?: number;
  rank?: unknown[];
};

type DynamicWorkMetadata = {
  dl_count: number | string;
  rate_average_2dp: number;
  rate_count: number;
  rate_count_detail?: unknown;
  review_count?: number;
  price?: number;
  rank?: unknown[];
};

const DLSITE_LANGUAGE_CONFIG = {
  'ja-jp': {
    cookieLocale: 'locale=ja-jp',
    ageRatingsLabel: '年齢指定',
    genreLabel: 'ジャンル',
    releaseLabel: '販売日',
    seriesLabel: 'シリーズ名',
    voiceActorLabel: '声優',
  },
  'zh-tw': {
    cookieLocale: 'locale=zh-tw',
    ageRatingsLabel: '年齡指定',
    genreLabel: '分類',
    releaseLabel: '販賣日',
    seriesLabel: '系列名',
    voiceActorLabel: '聲優',
  },
  'zh-cn': {
    cookieLocale: 'locale=zh-cn',
    ageRatingsLabel: '年龄指定',
    genreLabel: '分类',
    releaseLabel: '贩卖日',
    seriesLabel: '系列名',
    voiceActorLabel: '声优',
  },
} satisfies Record<string, DlsiteLanguageConfig>;

const getDlsiteLanguageConfig = (language: string): DlsiteLanguageConfig =>
  DLSITE_LANGUAGE_CONFIG[language] || DLSITE_LANGUAGE_CONFIG['zh-cn'];

const buildDlsiteWorkUrl = (id: number | string): string => {
  const rjcode = formatRjCode(id);
  return `https://www.dlsite.com/maniax/work/=/product_id/RJ${rjcode}.html`;
};

const buildDlsiteDynamicMetadataUrl = (id: number | string): string => {
  const rjcode = formatRjCode(id);
  return `https://www.dlsite.com/maniax-touch/product/info/ajax?product_id=RJ${rjcode}`;
};

const parseDynamicWorkMetadata = (data: DynamicMetadataInput): DynamicWorkMetadata => {
  const work = {} as DynamicWorkMetadata;
  work.dl_count = data.dl_count ? data.dl_count : '0'; // 售出数
  work.rate_average_2dp = data.rate_average_2dp ? data.rate_average_2dp : 0.0; // 平均评价
  work.rate_count = data.rate_count ? data.rate_count : 0; // 评价数量
  work.rate_count_detail = data.rate_count_detail; // 评价分布明细
  work.review_count = data.review_count; // 评论数量
  work.price = data.price; // 价格
  if (data.rank.length) {
    work.rank = data.rank; // 成绩
  }
  return work;
};

type ParseStaticWorkMetadataHtmlOptions = {
  html: string;
  id: number;
  url: string;
  languageConfig: DlsiteLanguageConfig;
  nameToUUID: (name: string) => string;
};

const parseStaticWorkMetadataHtml = ({
  html,
  id,
  url,
  languageConfig,
  nameToUUID,
}: ParseStaticWorkMetadataHtmlOptions): StaticWorkMetadata => {
  const $ = cheerio.load(html);
  const work: StaticWorkMetadata = { id, tags: [], vas: [] };

  work.title = $('meta[property="og:title"]').attr('content');
  if (work.title === undefined) {
    work.title = $(`a[href="${url}"] span`).text();
  }

  // 'xxxxx [circle_name] | DLsite' => 'xxxxx'
  const titlePattern = / \[.+\] \| DLsite$/;
  work.title = (work.title || '').replace(titlePattern, '');

  const circleElement = $('span[class="maker_name"]').children('a');
  const circleUrl = circleElement.attr('href');
  const circleName = circleElement.text();
  work.circle = circleUrl && circleName ? { id: parseInt(circleUrl.substr(-10, 5)), name: circleName } : {};

  const workOutline = $('#work_outline');
  const r18 = workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.ageRatingsLabel;
    })
    .parent()
    .children('td')
    .find('span:first')
    .text();
  work.nsfw = r18 === '18禁';

  const release = workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.releaseLabel;
    })
    .parent()
    .children('td')
    .text()
    .replace(/[^0-9]/gi, '');
  // 贩卖日页面文案会随 locale 变化，这里只保留数字并标准化为 YYYY-MM-DD。
  work.release = release.length >= 8 ? `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}` : '';

  const seriesElement = workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.seriesLabel;
    })
    .parent()
    .children('td')
    .children('a');
  if (seriesElement.length) {
    const seriesUrl = seriesElement.attr('href');
    const seriesMatch = seriesUrl?.match(/SRI(\d{10})/);
    if (seriesMatch) {
      work.series = {
        id: parseInt(seriesMatch[1]),
        name: seriesElement.text(),
      };
    }
  }

  workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.genreLabel;
    })
    .parent()
    .children('td')
    .children('div')
    .children('a')
    .each(function () {
      const tagUrl = $(this).attr('href');
      const tagName = $(this).text();
      const tagMatch = tagUrl?.match(/genre\/(\d{3})/);
      if (tagMatch) {
        work.tags.push({
          id: parseInt(tagMatch[1]),
          name: tagName,
        });
      }
    });

  workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.voiceActorLabel;
    })
    .parent()
    .children('td')
    .children('a')
    .each(function () {
      const vaName = $(this).text().trim();
      work.vas.push({
        id: nameToUUID(vaName),
        name: vaName,
      });
    });

  return work;
};

export {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
  parseStaticWorkMetadataHtml,
};
export type {
  DlsiteLanguageConfig,
  DynamicMetadataInput,
  DynamicWorkMetadata,
  StaticWorkMetadata,
  WorkCircle,
  WorkTag,
  WorkVoiceActor,
};
