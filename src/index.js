const _ = require('lodash');
const fs = require('fs');
const P = require('path');
const ASTQ = require('astq');
const CONSTRAINT_VISITORS = require('./constraint');


const CWD_ALSO_ASSUMED_TO_BE_PROJECT_ROOT = process.cwd();


const PACKAGE_INFO = JSON.parse(
  fs.readFileSync(P.join(__dirname, '/../package.json')).toString()
);
const PACKAGE_NAME = PACKAGE_INFO.name;
const PACKAGE_NAME_SHORT = PACKAGE_NAME.replace(/babel-plugin-/i, '');


function getBabelrcOpts() {
  // FIXME: more robust way of getting opts
  const path = P.join(CWD_ALSO_ASSUMED_TO_BE_PROJECT_ROOT, '.babelrc');
  if (!fs.existsSync(path)) {
    return {};
  }
  const str = fs.readFileSync(path).toString();
  const obj = JSON.parse(str);

  const { plugins } = obj;
  const found = (plugins || []).find((it) => {
    if (Array.isArray(it)) {
      return it[0] === PACKAGE_NAME_SHORT || it[0] === PACKAGE_NAME;
    }
    return it === PACKAGE_NAME_SHORT || it === PACKAGE_NAME;
  });
  return found ? found[1] : {};
}


function getFileConstraints(currentFile, opts) {
  if (!P.isAbsolute(currentFile)) {
    currentFile = P.join(CWD_ALSO_ASSUMED_TO_BE_PROJECT_ROOT, currentFile);
  }
  currentFile = P.normalize(currentFile);
  const { fileConstraints = [] } = opts || {};
  return fileConstraints.find((it) => {
    const fullname = P.normalize(P.join(CWD_ALSO_ASSUMED_TO_BE_PROJECT_ROOT, it.file));
    return fullname === currentFile;
  });
}


module.exports =  ({ types: t }) => {
  const { fileConstraints } = getBabelrcOpts();
  if (_.isEmpty(fileConstraints)) {
    return {};
  }

  let currentFile = '';
  const astq = new ASTQ();

  return {
    pre (file) {
      currentFile = file.opts.filename;
    },
    post () {
      currentFile = '';
    },
    visitor: {
      Program: {
        exit(path, state) {
          const fileConstraints = getFileConstraints(currentFile, state.opts);
          if (!fileConstraints) {
            return;
          }
          const { constraints } = fileConstraints;
          constraints.forEach((constraint) => {
            const { selector, def } = constraint;
            const res = astq.query(path.node, selector);
            if (!res || !res.length) {
              throw new Error(`Constraint"${JSON.stringify(constraint)}" match nothing`);
            }
            res.forEach((matchedNode) => {
              const validator = CONSTRAINT_VISITORS[def.type];
              if (!validator) {
                throw new Error(`constraint type(${def.type}) is not supported`);
              }
              validator.call(
                CONSTRAINT_VISITORS,
                matchedNode,
                constraint.def,
                { t, selector: constraint.selector });
            });
          });
        },
      },
    },
  };
};
