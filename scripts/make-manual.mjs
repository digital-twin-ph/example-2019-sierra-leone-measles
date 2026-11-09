// Writes manual.json: the steps that build this example's workflows in Fieldwork from an empty canvas.
// Nothing is random; running it again gives the same file. Usage: node scripts/make-manual.mjs <data commit>
import {writeFileSync} from 'node:fs';

const COMMIT=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(COMMIT??''))throw new Error('Give the full commit the data file is read from.');
const RAW=`https://raw.githubusercontent.com/digital-twin-ph/example-2019-sierra-leone-measles/${COMMIT}/data/`;
const FILE='measles-sierra-leone-semisynthetic.csv';
const ONSET='Onset/Start date',SEEN='Date seen at Health Facility/Community',FACILITY='Organisation unit name',
  DISTRICT='Residential District',AGE='Age (years)';
// THE COLUMNS EACH WORKFLOW KEEPS, named rather than dropped: a column added to the file later is then left out.
const KEYS=['Case number',FACILITY,DISTRICT,'Sex',ONSET,SEEN,'LRS Specimen test 01 - result'];

const steps={
  newProject:()=>[
    {click:'#new-project',label:'New project',opens:'New project'},
    {fill:'project-name-input',label:'Name',value:'Measles in Sierra Leone, 2019 to 2023',dialog:'New project'},
    {fill:'project-subject-input',label:'Subject',value:'A semi-synthetic measles line list made safe to teach with',dialog:'New project'},
    {click:'#project-create',label:'Create project',dialog:'New project'}],
  newWorkflow:()=>[{click:'#add-workflow',label:'Add workflow',view:'workflow'}],
  name:question=>[{fill:'workflow-name-edit',view:'project',label:'This workflow’s name — the question it answers',value:question}],
  // THE LINE LIST, one row per case: long, its key columns named, its value the age in years.
  importCases:as=>[
    {add:'table_input',as},{select:as},
    {click:'#open-table',label:'Configure…',opens:'Tabular data'},
    {click:'#table-remote summary',label:'Or fetch from a URL',dialog:'Tabular data'},
    {fill:'table-url',label:'URL of a CSV, Stata file or zip',value:RAW+FILE,dialog:'Tabular data'},
    {click:'#table-fetch',label:'Fetch',dialog:'Tabular data'},
    {choose:'table-shape',label:'Shape of the file',value:'long',shown:'Long',dialog:'Tabular data'},
    {choose:'table-value',label:'Value column',value:AGE,dialog:'Tabular data'},
    // THIRTY-ONE COLUMNS: the key columns are chosen in their own dialog, by name.
    {click:'#table-keys-choose',label:'Choose key columns\u2026',dialog:'Tabular data',opens:'Key columns'},
    {fill:'table-keys-paste',label:'Columns to keep, pasted or typed',value:KEYS.join(', '),dialog:'Key columns'},
    {click:'#table-keys-keep',label:'Keep these',dialog:'Key columns'},
    {click:'#table-keys-done',label:'Done',dialog:'Key columns'},
    {fill:'table-unit',label:'Unit of the value (entered by you)',value:'years',dialog:'Tabular data'},
    {click:'#table-save',label:'Apply',dialog:'Tabular data'}],
  // ROWS COUNTED BY THE COLUMNS KEPT: a line list carries no count, so Total within groups makes one.
  countBy:({as,from,keep})=>[
    {add:'group_table',as},{connect:{from,to:as,port:'records'}},{select:as},
    {click:'#configure-step',label:'Configure…',opens:'Total within groups'},
    {tick:'group-keep',label:'Key columns to keep',values:keep,dialog:'Total within groups'},
    {choose:'group-aggregate',label:'Aggregate',value:'count',shown:'Count rows',dialog:'Total within groups'},
    {click:'#config-apply',label:'Apply',dialog:'Total within groups'}],
};

const workflows=[];

// 1. THE EPIDEMIC CURVE: cases by week of onset, for every notified suspected case with an onset in 2019 to 2023.
workflows.push({name:'How did the outbreak unfold, month by month?',steps:[
  ...steps.newProject(),
  ...steps.name('How did the outbreak unfold, month by month?'),
  {note:'2,606 suspected measles cases notified in Sierra Leone, one row each. The file is semi-synthetic: whole records were swapped between cases of the same district and month, and every date moved by up to a week and set to its Monday. The curve keeps its shape; no row is a real person.'},
  ...steps.importCases('cases'),
  {note:'Keep the cases whose onset falls in 2019 to 2023. Two onsets fall outside the visits’ span, in 2017 and 2025, and 389 cases have no onset at all. The step leaves them out and says how many: they are findings about the file, not cleaned away.'},
  {add:'select_rows',as:'onset'},{connect:{from:'cases',to:'onset',port:'records'}},{select:'onset'},
  {click:'#configure-step',label:'Configure…',opens:'Select rows by value'},
  {choose:'select-key',label:'Key column to choose by',value:ONSET,dialog:'Select rows by value'},
  {choose:'select-mode',label:'Keep',value:'range',shown:'A range of dates',dialog:'Select rows by value'},
  {fill:'select-from',label:'From',value:'2019-01-01',dialog:'Select rows by value'},
  {fill:'select-to',label:'To',value:'2023-12-31',dialog:'Select rows by value'},
  {click:'#config-apply',label:'Apply',dialog:'Select rows by value'},
  {note:'A line list has no count in it, so count its rows by the onset date.'},
  ...steps.countBy({as:'byOnset',from:'onset',keep:[ONSET]}),
  {add:'case_series',as:'weekly'},{select:'weekly'},
  {choose:'series-input',label:'Records arrive as',value:'table',shown:'a table, each row a count'},
  {connect:{from:'byOnset',to:'weekly',port:'cases'}},
  {select:'weekly'},
  {fill:'series-date',label:'Event date attribute',value:ONSET},
  {choose:'series-kind',label:'Which date is it?',value:'onset'},
  {note:'Five years is about 260 weeks, more than a chart here draws; count by month, as multi-year measles surveillance is usually shown. Every date in the file was set to a Monday, so a week starting Monday is the finer choice for one year.'},
  {choose:'series-period',label:'Period',value:'month',shown:'month'},
  {click:'#add-series-chart',label:'Add epidemic curve',as:'curve'},
  {select:'curve'},
  {fill:'chart-label',label:'Results tab name',value:'Epidemic curve'},
  {fill:'chart-title',label:'Chart title',value:'Suspected measles cases by month of onset, Sierra Leone, 2019 to 2023'},
  {fill:'chart-subtitle',label:'Subtitle / context',value:'Every notified suspected case with an onset date in 2019 to 2023. Semi-synthetic: each date moved by up to a week, so a case near a month boundary may sit in the next.'},
  {fill:'chart-x-axis',label:'Horizontal axis label',value:'Month of onset'},
  {fill:'chart-source-note',label:'Source / method note',value:'Sierra Leone FETP line list, de-identified and made semi-synthetic for teaching (example-2019-sierra-leone-measles). Suspected cases, not confirmed ones.'},
  {run:true},
  {see:'the curve rising through 2022 and peaking in 2023',check:'Epidemic curve'}]});

// 2. CASES BY FACILITY: the facility each case was seen at, found in GRID3's register by its name, and coloured by count.
const SLE='urn:fieldwork:Grid3SierraLeoneHealthFacilitiesV1';
const at=(r,part,extra='')=>`[data-rule="${r}"]${extra}[data-part="${part}"]`;
const cond=(r,c)=>`[data-group="0"][data-condition="${c}"]`;
const band=(r,conditions,value)=>[{click:'#rule-editor-add',label:'+ Add a rule',dialog:'Apply ruleset'},
  ...conditions.flatMap(([comparator,shown,n],c)=>[
    ...(c?[{click:at(r,'add-condition','[data-group="0"]'),label:'+ and',dialog:'Apply ruleset'}]:[]),
    {choose:at(r,'field',cond(r,c)),label:'Field',value:'fwa:rows',shown:'rows',dialog:'Apply ruleset'},
    {choose:at(r,'comparator',cond(r,c)),label:'Comparator',value:comparator,shown,dialog:'Apply ruleset'},
    {fill:at(r,'value',cond(r,c)),label:'Value',value:String(n),dialog:'Apply ruleset'}]),
  {fill:at(r,'predicate','[data-then="0"]'),label:'Conclusion name',value:'cases',dialog:'Apply ruleset'},
  {fill:at(r,'conclusion','[data-then="0"]'),label:'Conclusion value',value,dialog:'Apply ruleset'}];
workflows.push({name:'Where were the cases seen?',steps:[
  ...steps.newWorkflow(),
  ...steps.name('Where were the cases seen?'),
  {note:'Each case names the facility it was seen at, under Organisation unit name. The file has no coordinates: the facilities are found by name in GRID3’s register of Sierra Leone’s health facilities (CC BY 4.0).'},
  ...steps.importCases('cases'),
  {note:'Count the cases at each facility, keeping its district, which tells apart two facilities of one name.'},
  ...steps.countBy({as:'byFacility',from:'cases',keep:[FACILITY,DISTRICT]}),
  {add:'table_output',as:'counts'},{connect:{from:'byFacility',to:'counts',port:'table'}},
  {run:true},
  {note:'Band each facility by its count. This file’s terms ask that a facility be mapped only where its count is large enough not to point at one child, so the band is also what decides which facilities are shown.'},
  {add:'apply_ruleset',as:'bands'},{select:'bands'},
  {click:'#configure-step',label:'Configure…',opens:'Apply ruleset'},
  {choose:'ruleset-choice',label:'Ruleset',value:'authored',shown:'Write rules for this step',dialog:'Apply ruleset'},
  {click:'#ruleset-config #config-apply',label:'Apply',dialog:'Apply ruleset'},
  {choose:'ruleset-records',label:'Records arrive as',value:'table',shown:'A table',dialog:'Apply ruleset'},
  {click:'#rule-editor #config-apply',label:'Apply',dialog:'Apply ruleset'},
  {connect:{from:'byFacility',to:'bands',port:'subjects'}},
  {select:'bands'},
  {click:'#configure-step',label:'Configure…',opens:'Apply ruleset'},
  {fill:'[aria-label="Unit for rows"]',label:'Unit for rows',value:'cases',dialog:'Apply ruleset'},
  ...band(0,[['lessThan','is less than',10]],'fewer than 10'),
  ...band(1,[['notLessThan','is at least',10],['lessThan','is less than',50]],'10 to 49'),
  ...band(2,[['notLessThan','is at least',50]],'50 or more'),
  {click:'#rule-editor #config-apply',label:'Apply',dialog:'Apply ruleset'},
  {note:'Keep the facilities with ten cases or more. The rest are counted, not mapped.'},
  {add:'select_rows',as:'shown'},{connect:{from:'bands',to:'shown',port:'records'}},{select:'shown'},
  {click:'#configure-step',label:'Configure…',opens:'Select rows by value'},
  {choose:'select-key',label:'Key column to choose by',value:'cases',dialog:'Select rows by value'},
  {fill:'select-values',label:'Values to keep, one per line',value:'10 to 49\n50 or more',dialog:'Select rows by value'},
  {click:'#config-apply',label:'Apply',dialog:'Select rows by value'},
  {note:'Show the facilities kept, in the table, and run: the next step reads their columns from it.'},
  {connect:{from:'shown',to:'counts',port:'table'}},
  {run:true},
  {add:'find_health_facilities',as:'found'},{select:'found'},
  {click:'#configure-step',label:'Configure…',opens:'Find health facilities'},
  {choose:'hf-mode',label:'Find facilities',value:'list',shown:'From a list',dialog:'Find health facilities'},
  {click:'#config-apply',label:'Apply',dialog:'Find health facilities'},
  {connect:{from:'shown',to:'found',port:'list'}},
  {select:'found'},
  {click:'#configure-step',label:'Configure…',opens:'Find health facilities'},
  {choose:'hf-name-column',label:'Column naming the facility',value:FACILITY,dialog:'Find health facilities'},
  {choose:'hf-area-column',label:'Column naming its area (optional)',value:DISTRICT,dialog:'Find health facilities'},
  {click:`label:has([data-hf-register="${SLE}"])`,label:'GRID3 SLE - Health Facilities v1.0',dialog:'Find health facilities'},
  {note:'A name ending in Communities is a chiefdom’s community reporting, an area rather than a facility: it has no point, and is counted.'},
  {click:'#config-apply',label:'Apply',dialog:'Find health facilities'},
  {note:'Fetch the register once; it is kept on this device, and the run makes no request.'},
  {click:'#hf-fetch-registers',label:'Fetch the registers'},
  {note:'The map places each facility against Sierra Leone’s outline, published by geoBoundaries.'},
  {add:'study_area',as:'country'},{select:'country'},
  {click:'#edit-study-area',label:'Select area on map',opens:'Choose your study area'},
  {click:'#area-boundary-source summary',label:'Use an administrative boundary',dialog:'Choose your study area'},
  {fill:'area-iso',label:'Country',value:'Sierra Leone',dialog:'Choose your study area'},
  {choose:'area-adm',label:'Level',value:'ADM0',dialog:'Choose your study area'},
  {click:'#area-boundary-check',label:'Check this level',dialog:'Choose your study area'},
  {pick:'area-boundary-pick',label:'Units',values:['Republic of Sierra Leone'],dialog:'Choose your study area'},
  {click:'#area-boundary-use',label:'Use the selected units',dialog:'Choose your study area'},
  {click:'#area-apply',label:'Apply study area',dialog:'Choose your study area'},
  {add:'map_output',as:'map'},
  {connect:{from:'country',to:'map',port:'area'}},
  {connect:{from:'found',to:'map',port:'points'}},
  {run:true},
  {note:'Colour each facility by its band.'},
  {select:'map'},
  {choose:'[data-pin-class]',label:'Pin class for Find health facilities',value:'cases'},
  {run:true},
  {select:'found'},
  {see:'every facility name marked: matched exactly, allowing for spelling, a type that differs, ambiguous, an area, or not found',
    within:'[data-standard-section="result"]',check:'Matched'},
  {see:'the facilities with ten cases or more, coloured by band, its key naming each',check:'50 or more'}]});

writeFileSync(new URL('../manual.json',import.meta.url),JSON.stringify({
  schema:'fieldwork/worked-example-manual/1',example:'urn:fieldwork:example:sierra-leone-measles',
  intro:'Each workflow reads the semi-synthetic line list from this repository, at a fixed commit. Start from an empty canvas: Project, then New project.',
  workflows},null,1)+'\n');
console.log('wrote manual.json:',workflows.map(w=>`${w.name} (${w.steps.length} steps)`).join('; '));
