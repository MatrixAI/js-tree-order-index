// @flow

// this is useful for composing multiple transactional contexts for immutable data structures
// this expects that the transactional contexts are implemented via the bracket pattern
// https://wiki.haskell.org/Bracket_pattern
// specifically the nest example
// nest :: [(r -> a) -> a] -> ([r] -> a) -> a
// nest xs = runCont (sequence (map cont xs))
// it's not exactly the same as nest, but very close idea

function nestContexts<context, contextResult, result> (
  contextCallbacks: Array<((context) => any) => contextResult>,
  callback: (Array<context>) => result,
  contexts: Array<context> = []
): [Array<contextResult>, result] {
  let results;
  if (!contextCallbacks.length) {
    results = [[], callback(contexts.reverse())];
  } else {
    const contextF = contextCallbacks.pop();
    const contextR = contextF(context => {
      contexts.push(context);
      results = nestContexts(contextCallbacks, callback, contexts);
    });
    // $FlowFixMe: results is built dynamically
    results[0].push(contextR);
  }
  // $FlowFixMe: results is built dynamically
  return results;
}

// here follows an example

function contextCall1 (callback) {
  const context = {
    doSomething: () => {
      return 1;
    }
  };
  callback(context);
  return 1;
}

function contextCall2 (callback) {
  const context = {
    doSomething: () => {
      return 2;
    }
  };
  callback(context);
  return 2;
}

function contextCall3 (callback) {
  const context = {
    doSomething: () => {
      return 3;
    }
  };
  callback(context);
  return 3;
}

const result = nestContexts([
  contextCall1,
  contextCall2,
  contextCall3
], ([a, b, c]) => {
  const aResult = a.doSomething();
  const bResult = b.doSomething();
  const cResult = c.doSomething();
  console.log('inputs', aResult, bResult, cResult); // inputs 1 2 3
  return aResult + bResult + cResult;
});

console.log(result); // [[1,2,3],6]
