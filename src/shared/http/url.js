const path = require('path');
const urljoin = require('url-join');

const encodeSplitFragments = fragments => {
  const expandedFragments = fragments.map(fragment => fragment.replace(/\\/g, '/').split('/'));
  return expandedFragments.flat().map(fragment => encodeURIComponent(fragment));
};

const joinFragments = (baseUrl, ...fragments) => {
  const pattern = new RegExp(/^https?:\/\//);
  const encodedFragments = encodeSplitFragments(fragments);

  if (pattern.test(baseUrl)) {
    return urljoin(baseUrl, ...encodedFragments);
  } else {
    return path.join(baseUrl, ...fragments).replace(/\\/g, '/');
  }
};

module.exports = { joinFragments };
