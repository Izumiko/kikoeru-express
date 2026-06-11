import path from 'path';
import { expect } from 'vitest';
import { createFolderCollector } from '../src/modules/scanner/folders/folder-collector.js';

async function* toAsyncIterable(items) {
  for (const item of items) {
    yield item;
  }
}

describe('createFolderCollector', () => {
  let calls;
  const rootFolders = [
    { name: 'RootA', path: path.join('/library', 'RootA') },
    { name: 'RootB', path: path.join('/library', 'RootB') },
  ];

  beforeEach(() => {
    calls = {
      folderRequests: [],
      mainLogs: [],
      consoleLogs: [],
    };
  });

  const createCollector = foldersByRoot =>
    createFolderCollector({
      rootFolders,
      getFolderList: (rootFolder, relativePath, depth, addMainLog) => {
        calls.folderRequests.push({ rootFolder, relativePath, depth, addMainLog });
        return toAsyncIterable(foldersByRoot[rootFolder.name] || []);
      },
      addMainLog: log => calls.mainLogs.push(log),
      consoleLogger: {
        log: message => calls.consoleLogs.push(message),
      },
    });

  it('collects folders from all configured roots', async () => {
    const { collectFolders } = createCollector({
      RootA: [{ id: 123, rootFolderName: 'RootA', relativePath: 'RJ000123' }],
      RootB: [{ id: 456, rootFolderName: 'RootB', relativePath: 'RJ000456' }],
    });

    const folders = await collectFolders();

    expect(folders.map(folder => folder.id)).to.deep.equal([123, 456]);
    expect(calls.folderRequests.map(call => call.rootFolder.name)).to.deep.equal(['RootA', 'RootB']);
    expect(calls.folderRequests.map(call => [call.relativePath, call.depth])).to.deep.equal([
      ['', 0],
      ['', 0],
    ]);
    expect(calls.consoleLogs).to.deep.equal([' * 共找到 2 个音声文件夹.']);
    expect(calls.mainLogs).to.deep.include({
      level: 'info',
      message: '共找到 2 个音声文件夹.',
    });
  });

  it('deduplicates folders and reports duplicate paths', () => {
    const { dedupeAndReport } = createCollector({});
    const result = dedupeAndReport([
      { id: 123, rootFolderName: 'RootA', relativePath: 'RJ000123-old' },
      { id: 123, rootFolderName: 'RootB', relativePath: 'RJ000123-new' },
      { id: 456, rootFolderName: 'RootA', relativePath: 'RJ000456' },
    ]);

    expect(result.uniqueFolderList.map(folder => folder.relativePath)).to.deep.equal(['RJ000123-new', 'RJ000456']);
    expect(result.duplicateNum).to.equal(1);
    expect(calls.consoleLogs).to.deep.equal([
      ' ! 发现 1 个重复的音声文件夹.',
      ' -> [RJ000123] 存在多个文件夹:',
      `   "${path.join('/library', 'RootA', 'RJ000123-old')}"`,
      `   "${path.join('/library', 'RootB', 'RJ000123-new')}"`,
    ]);
    expect(calls.mainLogs).to.deep.equal([
      {
        level: 'info',
        message: '发现 1 个重复的音声文件夹.',
      },
      {
        level: 'info',
        message: '[RJ000123] 存在多个文件夹:',
      },
      {
        level: 'info',
        message: `"${path.join('/library', 'RootA', 'RJ000123-old')}"`,
      },
      {
        level: 'info',
        message: `"${path.join('/library', 'RootB', 'RJ000123-new')}"`,
      },
    ]);
  });

  it('collects and deduplicates in one call', async () => {
    const { collectUniqueFolders } = createCollector({
      RootA: [{ id: 123, rootFolderName: 'RootA', relativePath: 'RJ000123-old' }],
      RootB: [{ id: 123, rootFolderName: 'RootB', relativePath: 'RJ000123-new' }],
    });

    const result = await collectUniqueFolders();

    expect(result.uniqueFolderList.map(folder => folder.relativePath)).to.deep.equal(['RJ000123-new']);
    expect(result.duplicateNum).to.equal(1);
  });
});
