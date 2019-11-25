
function isLiteral(t, node) {
  return t.isNullLiteral(node) ||
  t.isStringLiteral(node) ||
  t.isNumericLiteral(node) ||
  t.isBooleanLiteral(node);
}

module.exports = {
  enum (node, def, { isTest, t, selector } = {}) {
    const { options } = def;
    const actualValue = node.value;
    if (!isLiteral(t, node)) {
      if (isTest) {
        return false;
      }
      throw new Error(`Constraint violation: node: ${JSON.stringify(node)} is not literal`);
    }
    if (!options.some(it => it === actualValue)) {
      if (isTest) {
        return false;
      }
      throw new Error(`Constraint violation: "${selector}":
        none of enum options(${JSON.stringify(options)}) match actualValue(${actualValue})!`);
    }
    return true;
  },

  primitive (node, def, options = {}) {
    const { isTest, selector, t } = options;
    const { value } = def;
    if (!isLiteral(t, node)) {
      if (isTest) {
        return false;
      }
      throw new Error(`Constraint violation: node: ${JSON.stringify(node)} is not literal`);
    }
    if (value === undefined) {
      return true;
    }
    const actualValue = node.value;
    if (actualValue !== value) {
      if (isTest) {
        return false;
      }
      throw new Error(`Constraint violation: "${selector}":
        actualValue(${actualValue}) does not match constraint value(${value})!`);
    }
    return true;
  },

  string (node, def, options = {}) {
    const { isTest, t } = options;
    if (!t.isStringLiteral(node)) {
      if (isTest) {
        return false;
      }
      throw new Error(`Constraint violation: node: ${JSON.stringify(node)} is not string literal`);
    }
    return this.primitive(node, def, options);
  },

  bool (node, def, options = {}) {
    const { isTest, t } = options;
    if (!t.isBooleanLiteral(node)) {
      if (isTest) {
        return false;
      }
      throw new Error(`Constraint violation: node: ${JSON.stringify(node)} is not bool literal`);
    }
    return this.primitive(node, def, options);
  },

  number (node, def, options = {}) {
    const { isTest, t } = options;
    if (!t.isNumericLiteral(node)) {
      if (isTest) {
        return false;
      }
      throw new Error(`Constraint violation: node: ${JSON.stringify(node)} is not numeric literal`);
    }
    return this.primitive(node, def, options);
  },

  array (node, def, options = {}) {
    const { isTest, selector, t } = options;
    if (!t.isArrayExpression(node)) {
      if (!isTest) {
        throw new Error('Constraint violation: node ${JSON.stringify(node)} is supposed to be array expression but not');
      }
      return false;
    }
    if (!def.of) {
      return true;
    }
    const elementConstraints = Array.isArray(def.of) ? def.of : [def.of];
    const { "min-length": min, "max-length": max } = def;
    const { elements } = node;
    if (typeof min === 'number' && min > elements.length) {
      if (isTest) {
        return false;
      }

      throw new Error(`Constraint violation: array expression element count(${elements.length}) less than min-length: ${min}`);
    }
    if (typeof max === 'number' && max < elements.length) {
      if (isTest) {
        return false;
      }

      throw new Error(`Constraint violation: array expression element count(${elements.length}) more than max-length: ${max}`);
    }
    let errorMsg;
    const isPass = elements.every((ele) => {
      const isOk = elementConstraints.some((cons) => {
        return this[cons.type](ele, cons, { ...options, isTest: true });
      });
      if (!isOk) {
        errorMsg = `Constraint violation: "${selector}":
         Element Expression(${JSON.stringify(ele)}) match none of the element constraints(${JSON.stringify(elementConstraints)}) in array!`;
      }
      return isOk;
    });

    if (isPass) {
      return true;
    }

    if (isTest) {
      return false;
    }

    throw new Error(errorMsg);
  },

  tuple(node, def, options) {
    const { isTest, selector, t } = options;
    if (!t.isArrayExpression(node)) {
      if (!isTest) {
        throw new Error('Constraint violation: node ${JSON.stringify(node)} is supposed to be array expression but not');
      }
      return false;
    }
    if (!def.of) {
      return true;
    }
    const elementConstraints = Array.isArray(def.of) ? def.of : [def.of];
    const { elements } = node;
    if (elements.length != elementConstraints.length) {
      if (isTest) {
        throw new Error('Constraint violation: node ${JSON.stringify(node)} is not tuple of required length: ${elementConstraints.length}');
      }
      return false;
    }

    let errorMsg;
    const isPass = elementConstraints.every((cons, ii) => {
      const ele = elements[ii];
      const isOk = this[cons.type](ele, cons, { ...options, isTest: true });
      if (!isOk) {
        errorMsg = `Constraint violation: "${selector}":
         Element Expression(${JSON.stringify(ele)}) does not match element constraints(${JSON.stringify(elementConstraints)}) in array!`;
      }
      return isOk;
    });

    if (isPass) {
      return true;
    }

    if (isTest) {
      return false;
    }

    throw new Error(errorMsg);
  },

  object (node, def, options) {
    const { isTest, selector, t } = options;
    if (!t.isObjectExpression(node)) {
      if (!isTest) {
        throw new Error('Constraint violation: node ${JSON.stringify(node)} is supposed to be object expression but not');
      }
      return false;
    }

    if (!Array.isArray(def.properties)) {
      return true;
    }

    let errorMsg;
    const isOk = def.properties.every((kvPair) => {
      const key = kvPair[0];
      const valueDesc = kvPair[1];
      const actual = node.properties.find(it => it.key.name === key);
      if (!actual) {
        errorMsg = `Constraint violation: object: ${JSON.stringify(node, null, 4)} does not has property: ${key} as required`;
        return false;
      }
      if (!this[valueDesc.type](actual.value, valueDesc, { ...options, isTest: true })) {
        errorMsg = `Constraint violation: object property (${JSON.stringify(actual.value, null, 4)})does not match: ${JSON.stringify(valueDesc, null, 4)} as required`;
        return false;
      }
      return true;
    });

    if (isOk) {
      return true;
    }

    if (isTest) {
      return false;
    }

    throw new Error(errorMsg);
  }
};
