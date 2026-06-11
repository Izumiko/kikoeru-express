import { Parser } from 'htmlparser2';
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

type WriteTarget = 'circle.name' | 'tag.name' | 'va.name' | null;

const parseHvdbWorkMetadataHtml = ({ html, id, nameToUUID }: ParseHvdbWorkMetadataHtmlOptions): HvdbWorkMetadata => {
  const work: HvdbWorkMetadata = { id, tags: [], vas: [] };
  let writeTo: WriteTarget;

  const parser = new Parser(
    {
      onopentag: (name, attrs) => {
        if (name === 'input') {
          if (attrs.id === 'Name') {
            work.title = attrs.value;
          } else if (attrs.name === 'SFW') {
            work.nsfw = attrs.value === 'false';
          }
        }

        if (name === 'a') {
          if (attrs.href?.indexOf('CircleWorks') !== -1) {
            work.circle = {
              id: attrs.href.substring(attrs.href.lastIndexOf('/') + 1),
            };
            writeTo = 'circle.name';
          } else if (attrs.href?.indexOf('TagWorks') !== -1) {
            work.tags.push({
              id: attrs.href.substring(attrs.href.lastIndexOf('/') + 1),
            });
            writeTo = 'tag.name';
          } else if (attrs.href?.indexOf('CVWorks') !== -1) {
            work.vas.push({});
            writeTo = 'va.name';
          }
        }
      },
      onclosetag: () => {
        writeTo = null;
      },
      ontext: text => {
        switch (writeTo) {
          case 'circle.name':
            work.circle = work.circle || {};
            work.circle.name = text;
            break;
          case 'tag.name':
            work.tags[work.tags.length - 1].name = text;
            break;
          case 'va.name':
            work.vas[work.vas.length - 1].name = text;
            work.vas[work.vas.length - 1].id = nameToUUID(text);
            break;
          default:
        }
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();

  return work;
};

export {
  buildHvdbWorkUrl,
  parseHvdbWorkMetadataHtml,
};
export type { HvdbWorkMetadata };
