import path from 'path';
import urljoin from 'url-join';

const encodeSplitFragments = (fragments: string[]) => {
  const expandedFragments = fragments.map((fragment) => fragment.replace(/\\/g, '/').split('/'));
  return expandedFragments.flat().map((fragment) => encodeURIComponent(fragment));
};

const joinFragments = (baseUrl: string, ...fragments: string[]) => {
  const pattern = new RegExp(/^https?:\/\//);
  const encodedFragments = encodeSplitFragments(fragments);

  if (pattern.test(baseUrl)) {
    return urljoin(baseUrl, ...encodedFragments);
  } else {
    return path.join(baseUrl, ...fragments).replace(/\\/g, '/');
  }
};

export { joinFragments };
