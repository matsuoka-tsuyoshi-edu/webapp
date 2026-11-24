import os, json, glob

SAMPLE_DIR = os.path.dirname(os.path.abspath(__file__))

SUBJECT_ORDER = {
    'health': 1,
    'social_history': 2,
    'social_geo': 3,
    'social_civics': 4,
    'science_bio': 5,
    'science_astro': 6,
    'science_chem': 7,
    'general': 99
}

SCHOOL_ORDER = {
    'jh': 1,
    'elem': 2,
    'general': 99
}

def build():
    json_files = sorted(glob.glob(os.path.join(SAMPLE_DIR, '**', '*.json'), recursive=True))
    catalog_sets = []
    bundle_files = {}

    for jf in json_files:
        rel_path = os.path.relpath(jf, os.path.dirname(SAMPLE_DIR)).replace('\\', '/')
        if os.path.basename(jf) == 'catalog.json':
            continue

        with open(jf, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            data = [data]

        # Validate & store file contents for offline file:// fallback bundle
        bundle_files[rel_path] = data

        for item in data:
            qs = item.get('questions', [])
            q_types = []
            for q in qs:
                label = '〇×' if q.get('type') == '2choice' else '4択'
                if label not in q_types:
                    q_types.append(label)

            previews = [
                {
                    'type': q.get('type', '4choice'),
                    'question': q.get('question', '')
                }
                for q in qs
            ]
            search_parts = [
                item.get('title', ''),
                item.get('description', ''),
                item.get('schoolName', ''),
                item.get('subjectName', ''),
                item.get('topic', ''),
                *[q.get('question', '') + ' ' + q.get('explanation', '') for q in qs]
            ]

            catalog_sets.append({
                'id': item['id'],
                'school': item.get('school', 'general'),
                'schoolName': item.get('schoolName', '共通'),
                'subject': item.get('subject', 'general'),
                'subjectName': item.get('subjectName', '一般'),
                'topic': item.get('topic', '基本'),
                'title': item.get('title', ''),
                'description': item.get('description', ''),
                'dataFile': rel_path,
                'questionCount': len(qs),
                'questionTypes': '・'.join(q_types),
                'previewQuestions': previews,
                'searchText': ' '.join(search_parts)
            })

    # Sort cleanly by school order, subject order, then original set order
    def sort_key(entry):
        s_ord = SCHOOL_ORDER.get(entry['school'], 50)
        sub_ord = SUBJECT_ORDER.get(entry['subject'], 50)
        # Extract set number if present for natural ordering (set1..set10)
        import re
        m = re.search(r'set(\d+)', entry['id'])
        set_num = int(m.group(1)) if m else 999
        return (s_ord, sub_ord, set_num, entry['id'])

    catalog_sets.sort(key=sort_key)

    catalog_obj = {
        'version': '3.6.0',
        'totalSets': len(catalog_sets),
        'sets': catalog_sets
    }

    catalog_path = os.path.join(SAMPLE_DIR, 'catalog.json')
    with open(catalog_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(catalog_obj, f, ensure_ascii=False, indent=2)

    bundle_obj = {
        'catalog': catalog_obj,
        'files': bundle_files
    }
    bundle_path = os.path.join(SAMPLE_DIR, 'sample_bundle.js')
    with open(bundle_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Auto-generated offline fallback bundle for file:// access\n')
        f.write('window.POPQUIZ_SAMPLE_BUNDLE = ')
        json.dump(bundle_obj, f, ensure_ascii=False)
        f.write(';\n')

    print(f"Built catalog.json ({len(catalog_sets)} sets across {len(bundle_files)} files) and sample_bundle.js!")

if __name__ == '__main__':
    build()
