import CryptoJS from 'crypto-js';
import validator from 'validator';

// Password validation using validator.js
export const validatePassword = (password) => {
  if (!password) return 'Passwort ist erforderlich.';
  
  const options = {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  };
  
  if (!validator.isStrongPassword(password, options)) {
    return 'Passwort muss mindestens 8 Zeichen lang sein und Groß- und Kleinbuchstaben, Zahlen sowie Sonderzeichen enthalten.';
  }
  
  return null;
};

// Extract save data from Redux store state
export const extractSaveData = (state) => {
  return {
    scenarios: state.simScenario.scenarios,
    selectedScenarioId: state.simScenario.selectedScenarioId,
    selectedItems: state.simScenario.selectedItems,
    dataByScenario: state.simData.dataByScenario,
    bookingsByScenario: state.simBooking.bookingsByScenario,
    groupsByScenario: state.simGroup.groupsByScenario,
    groupDefsByScenario: state.simGroup.groupDefsByScenario,
    qualificationDefsByScenario: state.simQualification.qualificationDefsByScenario,
    qualificationAssignmentsByScenario: state.simQualification.qualificationAssignmentsByScenario,
    financialsByScenario: state.simFinancials.financialsByScenario,
    chartStore: {
      stichtag: state.chart.stichtag,
      selectedGroups: state.chart.selectedGroups,
      selectedQualifications: state.chart.selectedQualifications,
      midtermTimeDimension: state.chart.midtermTimeDimension,
      midtermSelectedGroups: state.chart.midtermSelectedGroups,
      midtermSelectedQualifications: state.chart.midtermSelectedQualifications,
      weeklySelectedScenarioId: state.chart.weeklySelectedScenarioId,
      midtermSelectedScenarioId: state.chart.midtermSelectedScenarioId,
      chartToggles: state.chart.chartToggles,
    }
  };
};

// Save data to encrypted file
export const saveToFile = async (data, password, filename = 'capakita-data.enc') => {
  try {
    const json = JSON.stringify(data, null, 2);
    const ciphertext = CryptoJS.AES.encrypt(json, password).toString();
    
    const blob = new Blob([ciphertext], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Load and decrypt data from file
export const loadFromFile = async (file, password) => {
  try {
    const ciphertext = await file.text();
    const bytes = CryptoJS.AES.decrypt(ciphertext, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      throw new Error('Falsches Passwort oder beschädigte Datei.');
    }
    
    const data = JSON.parse(decrypted);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
