// @flow

type TableLinkOpen<pointer, key> = {|
  leafOpen: pointer,
  gapKeyOpen: key
|};

type TableLinkClose<pointer, key> = {|
  leafClose: pointer,
  gapKeyClose: key
|};

type GapLink<pointer, key> = {|
  link: pointer,
  key: key
|};

export type { GapLink, TableLinkOpen, TableLinkClose };
