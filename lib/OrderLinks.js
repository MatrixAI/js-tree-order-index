//@flow

// the node table doesn't need to know what the order link is
// simply that it must be a thing that must hold be able to acquire based on an id
// also you don't really need to search from backlink to node
// cause the order entry also stores the id numbers as well
// note that orderLink represents an instantiation of other classes
// HOWEVER
// the TreeIndex must contain a node table that uses the same type of backlinks that the relevant order index supports
// OR...
// wait backlinks matter to BOTree and O-List, but not the AOTree
// so...
// the backlinks ARE NOT relevant to the Order Index
// only to the tree index
// but... wait they are
// The OrderIndex must support a particular type of backlink
// the NodeTable must then store that same type of backlink
// these are variables that then generalise the actual TreeIndex

// so now we have parameterised our NodeArray by the links they carry
// this ensures that we can make sure that our NodeArray only stores the correct links
// and that subsequent functions deals with all links available
// note that this is interesting cause links are special
// only certain links are available to certain things
// the BOTree can use all 3 types of links
// but we are just going to implement the GapLink

// more link implementations can be added here
type orderLink = GapLink;

class GapLink implements OrderLink {
  find () {
    
  }
}

export { GapLink };

export type { orderLink };
