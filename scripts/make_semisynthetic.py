"""Makes the semi-synthetic, de-identified teaching file from the Sierra Leone FETP measles line list.

Usage: python3 -I scripts/make_semisynthetic.py <original.csv> data/measles-sierra-leone-semisynthetic.csv

The original is NOT kept in this repository. What this does, and why:

- REMOVES free text that identifies people or homes: the four address columns (places travelled to, the addresses of
  contacts and of a pregnant contact), which hold street addresses and a name.
- REMOVES the date of birth, and age in months and days: with sex and facility, an exact date of birth made 90% of rows
  unique. Age in years is kept.
- REMOVES the travel and contact dates, each filled for under twenty rows, and "District where symptoms started",
  which is empty in every row.
- SWAPS WHOLE RECORDS, not single fields: everything about the patient (age, sex, status, symptoms, lab result, doses,
  case definition, and the onset, specimen and other dates, kept relative to the visit) moves together to another
  record of the same residential district and month seen, with a fixed seed. A district-month of one case widens to the
  quarter, then the year, then the country's month, then the whole file, so every record is swapped. A row at a clinic and week then carries another child's details.
- MOVES EACH VISIT by up to seven days either way, at random, and its other dates with it, so that "a measles case was
  seen at this clinic this week" is no longer a true statement about whoever was there.
- COARSENS every date to the Monday that starts its week (ISO 8601).

What is kept exactly: the number of cases by residential district and by facility over the whole period. Weekly counts
are approximate, by design. No row may be read as a person.

Facility names are kept: they are public places, and matching them to a facility list is an exercise of the example.
"""
import csv, random, sys, datetime, collections

SEED = 20261108
DROP = ['Date of Birth', 'Age (months)', 'Age (days)', 'MEA Address/Location travelled to', 'MEA Address of pregnant contact',
        'MEA Address of imported confirmed contact', 'MEA Address of confirmed contact', 'MEA Date of travel',
        'MEA Date of contact with imported confirmed case', 'MEA Date of confirmed contact', 'District where symptoms started']
DATES = ['Onset/Start date', 'Date seen at Health Facility/Community', 'LRQ Specimen 1 collected (date/time)',
         'LRS Specimen test 01 - result released date', 'MEA Date of last measles dose', 'MEA Date of Rash Onset', 'Date of investigation']

def day(value):
    value = value.strip()
    return datetime.date.fromisoformat(value[:10]) if value else None

def monday(d):
    return (d - datetime.timedelta(days=d.weekday())).isoformat() if d else ''

SEEN = 'Date seen at Health Facility/Community'
KEEP_PLACE = ['Organisation unit name', 'Residential District']

def main(source, target):
    with open(source, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        columns = [c for c in reader.fieldnames if c not in DROP]
        rows = [{c: r[c].strip() for c in columns} for r in reader]
    rng = random.Random(SEED)
    # THE PAYLOAD: everything but where and when the visit was, with its dates as days from the visit.
    payload_columns = [c for c in columns if c not in KEEP_PLACE and c != SEEN]
    def payload(r):
        seen = day(r[SEEN])
        p = {c: r[c] for c in payload_columns if c not in DATES}
        p['_offsets'] = {c: ((day(r[c]) - seen).days if seen and day(r[c]) else None) for c in DATES if c != SEEN}
        return p
    payloads = [payload(r) for r in rows]
    # STRATA, widened until each has at least two records.
    def key(r, level):
        d, seen = r['Residential District'], r[SEEN][:7]
        return [(d, seen), (d, seen[:4], (int(seen[5:7] or 1) - 1) // 3 if seen else None), (d, seen[:4]), ('', seen), ('', '')][level]
    level_of = {}
    for level in range(5):
        counts = collections.Counter(key(rows[i], level) for i in range(len(rows)) if i not in level_of)
        for i in range(len(rows)):
            if i not in level_of and (counts[key(rows[i], level)] >= 2 or level == 4):
                level_of[i] = level
    strata = collections.defaultdict(list)
    for i, level in level_of.items():
        strata[(level, key(rows[i], level))].append(i)
    out = [dict(r) for r in rows]
    for members in strata.values():
        donors = members[:]
        rng.shuffle(donors)
        # NO RECORD IS ITS OWN DONOR where there is anyone else to give: a shuffle that leaves a record in place is
        # broken by rotating the donors one step, which moves every record (a derangement of the group).
        if len(members) > 1 and any(i == j for i, j in zip(members, donors)):
            donors = [donors[(k + 1) % len(donors)] for k in range(len(donors))]
            while any(i == j for i, j in zip(members, donors)):
                rng.shuffle(donors)
        for i, j in zip(members, donors):
            # The visit moves by up to a week; the donor's dates follow it, at the donor's own distances.
            seen = day(rows[i][SEEN])
            moved = seen + datetime.timedelta(days=rng.randint(-7, 7)) if seen else None
            p = payloads[j]
            for c in payload_columns:
                if c not in DATES:
                    out[i][c] = p[c]
            for c, offset in p['_offsets'].items():
                out[i][c] = monday(moved + datetime.timedelta(days=offset)) if moved and offset is not None else ''
            out[i][SEEN] = monday(moved)
    rows = out
    # A CASE NUMBER, as a line list carries one: the original's identifiers were removed, and without one two cases with
    # the same details cannot be told apart. Numbered in an order drawn from its own seed, not the file's, so a number
    # says nothing about where a record stood in the original. Every other value is as above.
    order = list(range(len(rows)))
    random.Random(SEED + 1).shuffle(order)
    for number, i in enumerate(order, 1):
        rows[i] = {'Case number': f'SL-{number:04d}', **rows[i]}
    columns = ['Case number'] + columns
    with open(target, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=columns, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    return rows, strata

if __name__ == '__main__':
    rows, strata = main(sys.argv[1], sys.argv[2])
    import itertools
    def unique(keys):
        c = collections.Counter(tuple(r[k] for k in keys) for r in rows)
        return sum(1 for v in c.values() if v == 1)
    print(f'{len(rows)} rows, {len(rows[0])} columns; {len(strata)} strata, {sum(1 for m in strata.values() if len(m) == 1)} of one')
    for keys in [['Age (years)', 'Sex', 'Organisation unit name'],
                 ['Age (years)', 'Sex', 'Organisation unit name', 'Date seen at Health Facility/Community']]:
        print('rows unique on', keys, ':', unique(keys))
