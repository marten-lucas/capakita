import { DEFAULT_GROUP_ICON, normalizeGroupIcon } from '../utils/groupIcons';

/**
 * @typedef {Object} GroupDef
 * @property {string} id
 * @property {string} name
 * @property {string} [remark]
 * @property {string} [type] - Group type: "Krippe", "Regelgruppe", "Schulkindgruppe"
 * @property {boolean} [isSchoolKidGroup] - Derived from type === "Schulkindgruppe"
 * // ...add other properties as needed
 */

/**
 * GroupDef model class
 */
export class GroupDef {
  constructor({
    id,
    name = '',
    remark = '',
    type = 'Regelgruppe', // default to Regelgruppe
    isSchoolKidGroup = false,
    IsSchool = false,
    icon = DEFAULT_GROUP_ICON,
    ...rest
  }) {
    this.id = String(id);
    this.name = name;
    this.remark = remark;
    this.type = type;
    // Derive isSchoolKidGroup from type
    this.isSchoolKidGroup = type === 'Schulkindgruppe' || isSchoolKidGroup || IsSchool;
    this.IsSchool = this.isSchoolKidGroup;
    this.icon = normalizeGroupIcon(icon);
    Object.assign(this, rest);
  }
}
