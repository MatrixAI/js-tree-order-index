// @flow

type TreeId = number;
type GapKey = number;

// so now LinkOpen is actually a class now
// and we just return the properties
// as usual
// this will make it easier somewhat

type LinkOpen = {
  leafOpenId: TreeId,
  gapKeyOpen: GapKey
};

type LinkClose = {
  leafCloseId: TreeId,
  gapKeyClose: GapKey
};

export type { LinkOpen, LinkClose };
