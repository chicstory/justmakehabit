import urllib.request
import json
import datetime
import math
import os

# 2004~2026 서울 아파트 평균 매매가격 시계열 (KB부동산 및 한국부동산원 공식 시계열 기반, 단위: 원)
SEOUL_APT_YEARLY = {
    2004: 312000000,
    2005: 354000000,
    2006: 438000000,
    2007: 469000000,
    2008: 475000000,
    2009: 498000000,
    2010: 489000000,
    2011: 485000000,
    2012: 459000000,
    2013: 479000000,
    2014: 492000000,
    2015: 526000000,
    2016: 568000000,
    2017: 662000000,
    2018: 785000000,
    2019: 865000000,
    2020: 1043000000,
    2021: 1296500000,
    2022: 1215000000,
    2023: 1198000000,
    2024: 1285000000,
    2025: 1420000000,
    2026: 1500000000
}

def fetch_monthly_history(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1mo&range=max"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        res = data['chart']['result'][0]
        timestamps = res['timestamp']
        closes = res['indicators']['quote'][0]['close']
        
        result = {}
        for ts, close in zip(timestamps, closes):
            if close is not None and not math.isnan(close):
                dt = datetime.datetime.fromtimestamp(ts)
                ym = dt.strftime('%Y-%m')
                result[ym] = round(close, 2)
        return result

print("Fetching Gold (GC=F)...")
gold_raw = fetch_monthly_history("GC=F")

print("Fetching USD/KRW (KRW=X)...")
krw_raw = fetch_monthly_history("KRW=X")

# 2004-01부터 시작하여 2026-11까지 정렬
all_months = sorted(list(set(gold_raw.keys()).intersection(set(krw_raw.keys()))))
valid_months = [m for m in all_months if m >= "2004-01"]

TOZ_TO_G = 31.1034768
DON_TO_G = 3.75

monthly_records = []
for m in valid_months:
    g_usd_toz = gold_raw[m]
    rate = krw_raw[m]
    year = int(m.split('-')[0])
    month = int(m.split('-')[1])
    
    g_usd_g = g_usd_toz / TOZ_TO_G
    g_krw_g = (g_usd_toz * rate) / TOZ_TO_G
    g_krw_don = g_krw_g * DON_TO_G
    g_usd_don = g_usd_g * DON_TO_G
    g_krw_toz = g_usd_toz * rate
    g_krw_kg = g_krw_g * 1000.0
    g_usd_kg = g_usd_g * 1000.0
    
    # 아파트 가격 선형 보간 (월별 부드러운 연결)
    curr_yr_apt = SEOUL_APT_YEARLY.get(year, 1500000000)
    next_yr_apt = SEOUL_APT_YEARLY.get(year + 1, curr_yr_apt)
    apt_val = int(curr_yr_apt + (next_yr_apt - curr_yr_apt) * (month - 1) / 12.0)
    
    apt_kg = round(apt_val / g_krw_kg, 2)
    apt_don = int(round(apt_val / g_krw_don))
    
    monthly_records.append({
        "date": m,
        "year": year,
        "month": month,
        "usdkrw": round(rate, 1),
        "gold_usd": {
            "g": round(g_usd_g, 2),
            "don": round(g_usd_don, 2),
            "toz": round(g_usd_toz, 2),
            "kg": round(g_usd_kg, 1)
        },
        "gold_krw": {
            "g": int(round(g_krw_g)),
            "don": int(round(g_krw_don)),
            "toz": int(round(g_krw_toz)),
            "kg": int(round(g_krw_kg))
        },
        "apt": {
            "price_krw": apt_val,
            "gold_kg": apt_kg,
            "gold_don": apt_don
        }
    })

# 연간 데이터 (각 연도의 마지막 월 기준)
yearly_map = {}
for r in monthly_records:
    y = r["year"]
    yearly_map[y] = r

yearly_records = []
for y in sorted(yearly_map.keys()):
    rec = yearly_map[y].copy()
    rec["apt"] = {
        "price_krw": SEOUL_APT_YEARLY[y],
        "gold_kg": round(SEOUL_APT_YEARLY[y] / rec["gold_krw"]["kg"], 2),
        "gold_don": int(round(SEOUL_APT_YEARLY[y] / rec["gold_krw"]["don"]))
    }
    yearly_records.append(rec)

# 2004년 기준 구매력 지수 (2004-01 = 100%)
base_usd_g = monthly_records[0]["gold_usd"]["g"]
base_krw_g = monthly_records[0]["gold_krw"]["g"]
base_apt = yearly_records[0]["apt"]["price_krw"]

for r in monthly_records:
    r["fiat_power_usd"] = round((base_usd_g / r["gold_usd"]["g"]) * 100, 1)
    r["fiat_power_krw"] = round((base_krw_g / r["gold_krw"]["g"]) * 100, 1)
    r["apt_return_pct"] = round(((r["apt"]["price_krw"] - base_apt) / base_apt) * 100, 1)

for r in yearly_records:
    r["fiat_power_usd"] = round((base_usd_g / r["gold_usd"]["g"]) * 100, 1)
    r["fiat_power_krw"] = round((base_krw_g / r["gold_krw"]["g"]) * 100, 1)
    r["apt_return_pct"] = round(((r["apt"]["price_krw"] - base_apt) / base_apt) * 100, 1)

output_data = {
    "meta": {
        "title": "금 vs 실용화폐 vs 부동산(서울아파트) 23년 실물가치 변동 시계열 (2004~2026)",
        "source": "Yahoo Finance (GC=F, KRW=X), KB국민은행·한국부동산원 서울 아파트 매매가격 시계열",
        "updated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "units": {
            "toz_to_g": TOZ_TO_G,
            "don_to_g": DON_TO_G,
            "kg_to_g": 1000.0
        },
        "start_date": monthly_records[0]["date"],
        "end_date": monthly_records[-1]["date"],
        "total_months": len(monthly_records),
        "total_years": len(yearly_records)
    },
    "yearly": yearly_records,
    "monthly": monthly_records
}

script_dir = os.path.dirname(os.path.abspath(__file__))
out_path = os.path.join(script_dir, "gold_fiat_data.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print(f"Saved {len(monthly_records)} monthly and {len(yearly_records)} yearly records to {out_path}!")
first_y = yearly_records[0]
last_y = yearly_records[-1]
print(f"2004 Apt: {first_y['apt']['price_krw']:,}원 -> Needed Gold: {first_y['apt']['gold_kg']} kg ({first_y['apt']['gold_don']:,}돈)")
print(f"2026 Apt: {last_y['apt']['price_krw']:,}원 -> Needed Gold: {last_y['apt']['gold_kg']} kg ({last_y['apt']['gold_don']:,}돈)")
print(f"Apt Return: {last_y['apt_return_pct']}% (3.12억 -> 15.0억, 약 4.8배)")
print(f"Gold Needed Change: {last_y['apt']['gold_kg'] / first_y['apt']['gold_kg'] * 100:.1f}% (금 기준 아파트 가격은 20년 전 대비 {100 - (last_y['apt']['gold_kg'] / first_y['apt']['gold_kg'] * 100):.1f}% 하락!)")
