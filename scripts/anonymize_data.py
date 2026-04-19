import zipfile
import os
import sys
import xml.etree.ElementTree as ET
import random
import shutil
from datetime import datetime, timedelta
from io import BytesIO
from faker import Faker

# Anonymization using Faker for German data
fake = Faker('de_DE')

def shift_date(date_str):
    """Shifts a date by +/- 15 days to anonymize while keeping it realistic for statistics."""
    if not date_str or "." not in date_str:
        return date_str
    try:
        dt = datetime.strptime(date_str, "%d.%m.%Y")
        days_shift = random.randint(-15, 15)
        new_dt = dt + timedelta(days=days_shift)
        return new_dt.strftime("%d.%m.%Y")
    except ValueError:
        return date_str

def anonymize_xml(xml_content, filename):
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError:
        return xml_content

    changed = False

    if "kind.xml" in filename.lower():
        for kind in root.findall(".//KIND"):
            # Anonymize Child Details
            last_name = fake.last_name()
            first_name = fake.first_name()

            name_el = kind.find("NAME")
            if name_el is not None:
                name_el.text = last_name

            vorname_el = kind.find("VORNAME")
            if vorname_el is not None:
                vorname_el.text = first_name

            fname_el = kind.find("FNAME")  # Full name/Format name
            if fname_el is not None:
                fname_el.text = f"{last_name}, {first_name}"

            strasse_el = kind.find("STRASSE")
            if strasse_el is not None:
                strasse_el.text = fake.street_address()

            plz_el = kind.find("PLZ")
            if plz_el is not None:
                plz_el.text = fake.postcode()

            ort_el = kind.find("WOHNORT")
            if ort_el is not None:
                ort_el.text = fake.city()

            ortsteil_el = kind.find("ORTSTEIL")
            if ortsteil_el is not None:
                districts = ["Nord", "Süd", "West", "Ost", "Mitte", "Altstadt", "Neustadt"]
                ortsteil_el.text = random.choice(districts)

            tel_el = kind.find("TELEFON")
            if tel_el is not None:
                tel_el.text = fake.phone_number()

            geb_el = kind.find("GEBDATUM")
            if geb_el is not None:
                geb_el.text = shift_date(geb_el.text)

            gebort_el = kind.find("GEBORT")
            if gebort_el is not None:
                gebort_el.text = fake.city()

            # Relatives/Others
            for tag in ["GESCHW1VN", "GESCHW2VN", "GESCHW3VN", "ABHOLER"]:
                el = kind.find(tag)
                if el is not None and el.text:
                    el.text = fake.first_name()

            # Remarks
            for tag in ["BEMERKUNG", "WLNOTIZ", "GESBESOND"]:
                el = kind.find(tag)
                if el is not None and el.text:
                    el.text = "Anonymisierte Bemerkung"
            changed = True

    elif "belegung.xml" in filename.lower():
        for rec in root.findall(".//BELEGUNGSBUCHUNG"):
            bem_el = rec.find("BEMERK")
            if bem_el is not None and bem_el.text:
                bem_el.text = "Anonymisierter Kommentar"
                changed = True

    elif "anstell.xml" in filename.lower():
        # Anstellungsdaten have IDs but often no names directly in this XML based on schema
        # But we check for BEMERK
        for rec in root.findall(".//ANSTELLUNG"):
            bem_el = rec.find("BEMERK")
            if bem_el is not None and bem_el.text:
                bem_el.text = "Anonymisierte Anmerkung"
                changed = True

    if changed:
        return ET.tostring(root, encoding='utf-8')
    return xml_content

def process_zip(input_path, output_path):
    required_files = ["kind.xml", "anstell.xml", "belegung.xml", "gruppe.xml", "gruki.xml"]
    
    with zipfile.ZipFile(input_path, 'r') as zin:
        with zipfile.ZipFile(output_path, 'w') as zout:
            for item in zin.infolist():
                filename = os.path.basename(item.filename).lower()
                
                # Filter files: only keep what's in schema or explicitly required
                is_needed = False
                for req in required_files:
                    if filename.endswith(req):
                        is_needed = True
                        break
                
                if is_needed:
                    content = zin.read(item.filename)
                    anonymized_content = anonymize_xml(content, filename)
                    zout.writestr(item.filename, anonymized_content)
                else:
                    print(f"Skipping unnecessary file: {item.filename}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python anonymize_data.py <input_zip> [<output_zip>]")
        sys.exit(1)

    input_zip = sys.argv[1]
    output_zip = sys.argv[2] if len(sys.argv) > 2 else input_zip.replace(".zip", "_anonymized.zip")

    if not os.path.exists(input_zip):
        print(f"Error: {input_zip} not found.")
        sys.exit(1)

    print(f"Anonymizing {input_zip}...")
    
    # Generate an anonymized filename if not provided
    if len(sys.argv) <= 2:
        random_suffix = fake.bothify(text='-########')
        output_zip = os.path.join(os.path.dirname(input_zip), f"kita-anonym{random_suffix}.zip")
    else:
        output_zip = sys.argv[2]
        
    process_zip(input_zip, output_zip)
    print(f"Done. Saved to {output_zip}")
