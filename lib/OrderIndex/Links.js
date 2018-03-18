// @flow

type TreeId = number;
type GapKey = number;

// these have to be objects cause we are just
// using them like ... objects
// we can use exact object types
// to prevent other things and maybe the typecheck will work

type LinkOpen = {|
  leafOpenId: TreeId,
  gapKeyOpen: GapKey
|};

type LinkClose = {|
  leafCloseId: TreeId,
  gapKeyClose: GapKey
|};

export type { LinkOpen, LinkClose };
