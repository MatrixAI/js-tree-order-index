// @flow

type GapLinkOpen<b> = {
  blockOpen: b,
  keyOpen: number
};

type GapLinkClose<b> = {
  blockClose: b,
  keyClose: number
};

function extractGapLinkOpen ({blockOpen, keyOpen}) {
  return {blockOpen, keyOpen};
}

function extractGapLinkClose ({blockOpen, keyOpen}) {
  return {blockClose, keyClose};
}

// these will be used for extraction of link open and link close
// wait... don't I need to know how to work these?
// well yea if I get a link, how do I find it?
// that's a good point if the link is generic
// then how would I extract things out?
// that's a good point
// because I don't know what blockOpen points to
// to find it
// you need some sort of function that takes GapLinkOpen<b> to Cursor
// but GapLinkOpen is tak

export {
  extractGapLinkOpen,
  extractGapLinkClose
};

export type { GapLinkOpen, GapLinkClose };
