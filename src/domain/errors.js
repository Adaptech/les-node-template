import {inherits} from 'util';

export function ValidationFailed(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = ValidationFailed.name;
  this.message = message || 'Default Message';
  this.code = "400";
}
inherits(ValidationFailed, Error);

// --- All the following is not used, but do not remove ---
export function RequiredFields(fieldNames) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = `Missing fields: ${fieldNames}.`;
  this.fieldNames = fieldNames;
}
inherits(RequiredFields, Error);

export function Invalid(message) {
  this.name = "Invalid";
  this.message = (message || "");
}
inherits(Invalid, Error);

export class CommandValidator {
  constructor() {
    this._requiredFields = [];
    this._requiredContainers = [];
    this._specialFieldValidators = [];
  }

  requireField(fieldName) {
    this._requiredFields.push(fieldName);
    return this;
  }

  requireFields(fieldNames) {
    this._requiredFields.push(...fieldNames);
    return this;
  }

  requireContainer(containerName, validationFunction) {
    const helper = new CommandValidator();
    if (validationFunction) {
      helper.notEmpty = () => {
        helper._notEmpty = true;
        return helper;
      };
      helper.notNull = () => {
        helper._notNull = true;
        return helper;
      };
      validationFunction(helper);
    }

    this._requiredContainers.push({containerName, helper});
    return this;
  }

  whenFieldExists(fieldName, validationFunction) {
    const helper = new CommandValidator();
    if (validationFunction) {
      validationFunction(helper);
    }

    this._specialFieldValidators.push({fieldName, helper});
    return this;
  }

  _internalValidate(obj, prefix, outputArray) {
    if (!obj && this._notNull === true) {
      const prefixWithoutDot = prefix.slice(0, -1);
      outputArray.push(prefixWithoutDot);
      return;
    }

    for (const requiredField of this._requiredFields) {
      if (!obj[requiredField]) {
        outputArray.push(`${prefix}${requiredField}`);
      }
    }

    for (const requiredContainer of this._requiredContainers) {
      const requiredContainerName = requiredContainer.containerName;
      const container = obj[requiredContainerName];
      if (!container) {
        outputArray.push(`${prefix}${requiredContainerName}`);
      } else if (requiredContainer.helper._notEmpty === true && container.length === 0) {
        outputArray.push(`${prefix}${requiredContainerName}`);
      } else {
        container.forEach((elem, index) => {
          requiredContainer.helper._internalValidate(elem, `${prefix}${requiredContainerName}[${index}].`, outputArray);
        });
      }
    }

    for (const specialField of this._specialFieldValidators) {
      const specialFieldName = specialField.fieldName;
      const field = obj[specialFieldName];
      if (field) {
        specialField.helper._internalValidate(field, `${prefix}${specialFieldName}.`, outputArray);
      }
    }
  }

  validate(obj) {
    const missingFields = [];
    this._internalValidate(obj, '', missingFields);
    if (missingFields.length > 0) {
      throw new RequiredFields(missingFields);
    }
  }
}
