import * as cheerio from 'cheerio';
import type { StaticWorkMetadata, WorkCircle, WorkTag, WorkVoiceActor } from './dlsite-metadata.js';

const buildHvdbWorkUrl = (id: number | string): string => `https://hvdb.me/Dashboard/WorkDetails/${id}`;

type HvdbWorkMetadata = Omit<StaticWorkMetadata, 'circle' | 'tags'> & {
  circle?: WorkCircle;
  tags: Array<Partial<WorkTag>>;
  vas: Array<Partial<WorkVoiceActor>>;
};

type ParseHvdbWorkMetadataHtmlOptions = {
  html: string;
  id: number;
  nameToUUID: (name: string) => string;
};

const parseHvdbWorkMetadataHtml = ({ html, id, nameToUUID }: ParseHvdbWorkMetadataHtmlOptions): HvdbWorkMetadata => {
  const work: HvdbWorkMetadata = { id, tags: [], vas: [] };
  const $ = cheerio.load(html);

  // 解析标题
  const title = $('input#Name').attr('value');
  if (title) {
    work.title = title;
  }

  // 解析是否 SFW (NSFW)
  const sfw = $('input[name="SFW"]').attr('value');
  if (sfw !== undefined) {
    work.nsfw = sfw === 'false';
  }

  // 解析社团 (Circle)
  const circleEl = $('a[href*="CircleWorks"]').first();
  if (circleEl.length) {
    const href = circleEl.attr('href') || '';
    work.circle = {
      id: href.substring(href.lastIndexOf('/') + 1),
      name: circleEl.text().trim(),
    };
  }

  // 解析标签 (Tags)
  $('a[href*="TagWorks"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    work.tags.push({
      id: href.substring(href.lastIndexOf('/') + 1),
      name: $el.text().trim(),
    });
  });

  // 解析声优 (Voice Actors)
  $('a[href*="CVWorks"]').each((_, el) => {
    const vaName = $(el).text().trim();
    work.vas.push({
      id: nameToUUID(vaName),
      name: vaName,
    });
  });

  return work;
};

export { buildHvdbWorkUrl, parseHvdbWorkMetadataHtml };
export type { HvdbWorkMetadata };
