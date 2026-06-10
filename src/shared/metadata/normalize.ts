import strftime from './strftime.js';

type StaticMetadataRecord = {
  nsfw?: unknown;
  circleObj?: string;
  circle?: unknown;
  rate_count_detail?: string | unknown;
  rank?: string | null | unknown;
  vaObj?: string;
  vas?: unknown;
  tagObj?: string;
  tags?: unknown;
  updated_at?: string | Date;
  [key: string]: unknown;
};

type NormalizeOptions = {
  dateOnly?: boolean;
};

const normalize = <T extends StaticMetadataRecord>(works: T[], options: NormalizeOptions = {}): T[] => {
  works.map(record => {
    record.nsfw = Boolean(record.nsfw);
    record.circle = JSON.parse(record.circleObj as string);
    record.rate_count_detail = JSON.parse(record.rate_count_detail as string);
    record.rank = record.rank ? JSON.parse(record.rank as string) : null;
    record.vas = JSON.parse(record.vaObj as string)['vas'];
    record.tags = JSON.parse(record.tagObj as string)['tags'];
    delete record.circleObj;
    delete record.vaObj;
    delete record.tagObj;
    if (options.dateOnly && record.updated_at) {
      record.updated_at = strftime('%F', record.updated_at);
    }
  });
  return works;
};

export default normalize;
