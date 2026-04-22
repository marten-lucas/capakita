import { DEFAULT_GROUP_ICON, normalizeGroupIcon } from '../utils/groupIcons';

/**
 * @typedef {Object} GroupDef
 * @property {string} id
 * @property {string} name
 * @property {string} [remark]
 * @property {string} [type] - Group type: "Krippe", "Regelgruppe", "Schulkindgruppe"
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
    type,
    icon = DEFAULT_GROUP_ICON,
    ...rest
  }) {
    this.id = String(id);
    this.name = name;
    this.remark = remark;
    const { isSchoolKidGroup, IsSchool, ...remainingRest } = rest;
    this.type = type || (isSchoolKidGroup || IsSchool ? 'Schulkindgruppe' : 'Regelgruppe');
    this.icon = normalizeGroupIcon(icon);
    Object.assign(this, remainingRest);
  }
}
