// @flow

type TreeId = number;
type GapKey = number;

type LinkOpen = {
  leafOpen: TreeId,
  gapKeyOpen: GapKey
};

type LinkClose = {
  leafClose: TreeId,
  gapKeyClose: GapKey
};

export type { LinkOpen, LinkClose };
