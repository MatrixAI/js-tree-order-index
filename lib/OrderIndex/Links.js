// @flow

type TreeId = number;
type GapKey = number;

type LinkOpen = {
  leafOpenId: TreeId,
  gapKeyOpen: GapKey
};

type LinkClose = {
  leafCloseId: TreeId,
  gapKeyClose: GapKey
};

export type { LinkOpen, LinkClose };
