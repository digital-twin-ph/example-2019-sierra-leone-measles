# Measles in Sierra Leone, 2019 to 2023: a semi-synthetic teaching file

A worked example for [Fieldwork](https://github.com/digital-twin-ph/fieldwork), **in progress**: the data are here and
the workflows are not yet built.

**This is not surveillance data, and no row is a person.** It is made from a measles line list that the Sierra Leone
Field Epidemiology Training Program (FETP) produced for training. Before anything was kept here it was de-identified
and made semi-synthetic by [scripts/make_semisynthetic.py](scripts/make_semisynthetic.py). The original is not in this
repository's files.

## What was done to it

| Step | Why |
| --- | --- |
| The four address columns are removed (places travelled to, and the addresses of contacts and of a pregnant contact) | They held street addresses and a name |
| Date of birth is removed, and age in months and days; age in years is kept | With sex and facility, an exact date of birth made 90% of rows unique |
| The travel and contact dates are removed, and "District where symptoms started" | Each date was filled for under twenty rows; the district was empty in every row |
| **Whole records are swapped**: age, sex, status, symptoms, lab result, doses, case definition and their dates move together to another record of the same residential district and month seen (widened to the quarter, year, country's month, then the whole file, until each group has two or more). No record keeps its own details where there is another to swap with | A row at a clinic and week carries another child's details |
| Each visit is moved by up to seven days either way, at random, with its other dates | "A measles case was seen at this clinic this week" is no longer true of whoever was there |
| Every date is the Monday that starts its week (ISO 8601) | Days are not needed for an epidemic curve by week |

The swaps and moves use a fixed seed, so the script gives the same file every time from the same original.

**Kept exactly:** the number of cases by residential district and by facility, and the totals of age, sex, lab results,
status and case definition over the whole file. **Approximate, by design:** counts by week. **Not true of any child:**
any one row's combination of details.

## The file

[data/measles-sierra-leone-semisynthetic.csv](data/measles-sierra-leone-semisynthetic.csv): 2,606 rows, 30 columns,
one per suspected measles case seen from January 2019 to December 2023, most of them in 2022 and 2023. Columns are as
the source's export named them: an organisation unit (the facility, by name), residential district, age in years, sex,
dates of onset, being seen, specimen and result, symptoms, routine doses, lab result and whether the case met the
definition.

**What it says about itself, as found:** about 18% of rows have no residential district; most clinical fields are
empty for most rows (a lab result for 570 of 2,606); one age over 100 comes from a date of birth entered in 1904; one onset
falls before 2019, in 2017. These are kept as found, to be named as data quality findings, not repaired.

## Use

For teaching: an epidemic curve, cases by district, the share meeting the case definition and with a lab result, and
whether facility names can be matched to an open facility list. Maps should show counts by district, or by facility
only where a count is large enough not to point at one child.

## Terms

Produced by the Sierra Leone FETP for training. **The terms under which it may be shared beyond training are not
yet stated here.**
