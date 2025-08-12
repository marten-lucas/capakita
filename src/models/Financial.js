/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} type   // e.g. 'income', 'expense'
 * @property {number} amount
 * @property {string} valid_from
 * @property {string} valid_to
 * @property {string} currency
 * @property {string} frequency // e.g. 'monthly', 'yearly'
 * // ...add other properties as needed
 */

/**
 * @typedef {Object} Financial
 * @property {string} id
 * @property {string} dataItemId
 * @property {string} type
 * @property {string} [parentId] 
 * @property {string} name
 * @property {string} valid_from
 * @property {string} valid_to
 * @property {Object} [type_details] // User-editable fields, e.g. for AVR: stage, group, StartDate, NoOfChildren, WorkingHours; for income-fee: group_ref
 * @property {string} [financialDefId] // Only for income-fee type
 * @property {Array<Financial>} [financial] // Stacked financials (e.g. bonuses)
 * // ...add other properties as needed
 */

/**
 * Financial model class
 */
export class Financial {
  constructor({
    id,
    type = '',
    label = '',
    amount = '',
    from = '',
    to = '',
    note = '',
    valid_from = '',
    valid_to = '',
    type_details = {},
    ...rest
  }) {
    this.id = String(id);
    this.type = type;
    this.label = label;
    this.amount = amount;
    this.from = from;
    this.to = to;
    this.note = note;
    this.valid_from = valid_from;
    this.valid_to = valid_to;
    // Defensive: ensure type_details is always an object
    this.type_details = type_details && typeof type_details === 'object' ? { ...type_details } : {};
    Object.assign(this, rest);
  }


  initializeTypeDetails(type, existingDetails = {}) {
    const defaultDetails = Financial.getDefaultTypeDetails(type);
    
    // If existingDetails is empty or invalid, return defaults
    if (!existingDetails || typeof existingDetails !== 'object') {
      return { ...defaultDetails };
    }
    
    // Merge existing details with defaults, ensuring we have actual values not schemas
    const merged = { ...defaultDetails };
    
    Object.keys(existingDetails).forEach(key => {
      const value = existingDetails[key];
      // If value is a schema object (has type, required, label properties), skip it
      if (value && typeof value === 'object' && 
          (Object.prototype.hasOwnProperty.call(value, 'type') || 
           Object.prototype.hasOwnProperty.call(value, 'required') || 
           Object.prototype.hasOwnProperty.call(value, 'label'))) {
        // This is a schema definition, use default value instead
        merged[key] = defaultDetails[key] !== undefined ? defaultDetails[key] : '';
      } else {
        // This is an actual value, use it
        merged[key] = value;
      }
    });
    
    return merged;
  }

  static getDefaultTypeDetails(type) {
    const defaults = {
      'income-fee': {
        financialDefId: '',
        group_ref: ''
      },
      'expense-avr': {
        employeeId: '',
        payGrade: '',
        workingHours: 0
      },
      'expense-custom': {
        customAmount: 0,
        description: ''
      },
      'income-baykibig': {
        fundingType: '',
        ratePerChild: 0
      },
      'bonus-yearly': {
        bonusAmount: 0,
        paymentMonth: 12
      },
      'bonus-children': {
        bonusPerChild: 0,
        maxChildren: 0
      },
      'bonus-instructor': {
        bonusAmount: 0,
        instructorLevel: ''
      }
    };
    
    return defaults[type] || {};
  }

  static typeDetailsDefinitions = {
    'income-fee': {
      financialDefId: { type: 'string', required: true, label: 'Beitragsordnung' },
      group_ref: { type: 'string', required: false, label: 'Gruppenreferenz' }
    },
    'expense-avr': {
      employeeId: { type: 'string', required: true, label: 'Mitarbeiter' },
      payGrade: { type: 'string', required: true, label: 'Entgeltgruppe' },
      workingHours: { type: 'number', required: true, label: 'Arbeitszeit' }
    },
    'expense-custom': {
      customAmount: { type: 'number', required: true, label: 'Betrag' },
      description: { type: 'string', required: false, label: 'Beschreibung' }
    },
    'income-baykibig': {
      fundingType: { type: 'string', required: true, label: 'Förderart' },
      ratePerChild: { type: 'number', required: true, label: 'Satz pro Kind' }
    },
    'bonus-yearly': {
      bonusAmount: { type: 'number', required: true, label: 'Bonushöhe' },
      paymentMonth: { type: 'number', required: true, label: 'Auszahlungsmonat' }
    },
    'bonus-children': {
      bonusPerChild: { type: 'number', required: true, label: 'Bonus pro Kind' },
      maxChildren: { type: 'number', required: false, label: 'Max. Kinder' }
    },
    'bonus-instructor': {
      bonusAmount: { type: 'number', required: true, label: 'Bonushöhe' },
      instructorLevel: { type: 'string', required: true, label: 'Anleiterstufe' }
    }
  };
}

