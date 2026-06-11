import path from 'path';

const encodeSplitFragments = (fragments: string[]) => {
  const expandedFragments = fragments.map((fragment) => fragment.replace(/\\/g, '/').split('/'));
  return expandedFragments.flat().map((fragment) => encodeURIComponent(fragment));
};

const joinFragments = (baseUrl: string, ...fragments: string[]) => {
  const pattern = new RegExp(/^https?:\/\//);
  const encodedFragments = encodeSplitFragments(fragments).filter(Boolean);

  if (pattern.test(baseUrl)) {
    const baseWithSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const url = new URL(encodedFragments.join('/'), baseWithSlash);
    return url.href;
  } else {
    return path.join(baseUrl, ...fragments).replace(/\\/g, '/');
  }
};

export { joinFragments };
