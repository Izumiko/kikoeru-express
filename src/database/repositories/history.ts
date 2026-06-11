import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../client.js';
import { histories } from '../schema/tables.js';

type HistoryRecord = {
  userName: string;
  workId: number;
  fileIndex: string;
  fileName: string | null;
  playTime: number | null;
  totalTime: number | null;
};

const insertHistory = (record: HistoryRecord) =>
  db
    .insert(histories)
    .values(record)
    .onConflictDoUpdate({
      target: [histories.userName, histories.workId, histories.fileIndex],
      set: {
        fileName: record.fileName,
        playTime: record.playTime,
        totalTime: record.totalTime,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });

const getHistoryByUsername = (username: string, limit = 1000, offset = 0) =>
  db
    .select()
    .from(histories)
    .where(eq(histories.userName, username))
    .orderBy(desc(histories.updatedAt))
    .limit(limit)
    .offset(offset);

const getHistoryByWorkIdIndex = (username: string, workId: number, fileIndex: string) =>
  db
    .select()
    .from(histories)
    .where(and(eq(histories.userName, username), eq(histories.workId, workId), eq(histories.fileIndex, fileIndex)));

const getHistoryGroupByWorkId = (username: string) =>
  db
    .select()
    .from(histories)
    .where(eq(histories.userName, username))
    .groupBy(histories.workId)
    .orderBy(desc(histories.updatedAt));

export { getHistoryByUsername, getHistoryByWorkIdIndex, getHistoryGroupByWorkId, insertHistory };
export type { HistoryRecord };
