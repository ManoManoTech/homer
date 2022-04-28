module.exports = [
  {
    regex: /\.(js|tsx?)$/,
    commands: ['eslint'],
  },
  {
    regex: /\.(js|json|md|tsx?)$/,
    commands: ['prettier --write', 'git add'],
  },
];
