"""District population of Sierra Leone, 2019 to 2023, summed from WorldPop over COD-AB's 16 districts.

Sources, downloaded 2026-11-09 into one folder, given as the only argument:
  sle_pop_{2019..2023}.tif  WorldPop Global2 R2025A v1, constrained, 100 m, population counts (doi:10.5258/SOTON/WP00839),
                            https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/{YEAR}/SLE/v1/100m/constrained/
                            Licence: Creative Commons Attribution 4.0 International. Modelled estimates; WorldPop calls
                            R2025A an alpha version.
  codab/sle_admin2.geojson  OCHA COD-AB, Sierra Leone administrative boundaries (cod-ab-sle, data.humdata.org),
                            licence CC BY-IGO. 16 districts; "Fabala" is its spelling of Falaba.

Writes district_pop.json beside them: each district's sum per year. The district sums cover 99.8% of each raster's
total; the rest lies on the borders. data/district-population.csv in this repository is that result, with the 2021
Mid-Term Census totals (Statistics Sierra Leone, 2021_MTPHC_Final_Results_Tables_ByDistrict.pdf; "Source: STATISTICS
SIERRA LEONE") beside them for comparison. Run with Python, rasterio and numpy: python scripts/district_population.py <folder>
"""
import json,sys,rasterio,numpy
from rasterio.features import geometry_mask
from rasterio.mask import mask
D=sys.argv[1]
gj=json.load(open(D+'/codab/sle_admin2.geojson'))
rows={}
for y in range(2019,2024):
    with rasterio.open(f'{D}/sle_pop_{y}.tif') as src:
        nodata=src.nodata
        total=0
        for f in gj['features']:
            out,_=mask(src,[f['geometry']],crop=True,filled=True,nodata=nodata if nodata is not None else -99999)
            a=out[0].astype('float64');a=a[(a!=(nodata if nodata is not None else -99999))&numpy.isfinite(a)&(a>=0)]
            v=float(a.sum());rows.setdefault(f['properties']['adm2_name'],{})[y]=v;total+=v
        whole=src.read(1).astype('float64');w=whole[(whole!=nodata)&numpy.isfinite(whole)&(whole>=0)] if nodata is not None else whole
        print(y,'districts sum',round(total),'raster total',round(float(w.sum())))
for name in sorted(rows):print(f'{name:20}',' '.join(f'{round(rows[name][y]):>9}' for y in range(2019,2024)))
json.dump(rows,open(D+'/district_pop.json','w'))
