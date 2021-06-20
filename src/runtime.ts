// verify commits are traversing properly
const traversal = [];
const errors = [];

export default {
  next(commit) {
    traversal.push(commit);
  },
  prev(commit) {
    const lastRead = traversal.pop(commit);
    if (commit !== lastRead) {
      errors.push([`pos ${traversal.length}: got ${commit}, want ${lastRead}`]);
    }
  },
};
