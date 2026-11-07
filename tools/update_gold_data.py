import urllib.request
import json
import datetime
import math
import os

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
    
    g_usd_g = g_usd_toz / TOZ_TO_G
    g_krw_g = (g_usd_toz * rate) / TOZ_TO_G
    g_krw_don = g_krw_g * DON_TO_G
    g_usd_don = g_usd_g * DON_TO_G
    g_krw_toz = g_usd_toz * rate
    g_krw_kg = g_krw_g * 1000.0
    g_usd_kg = g_usd_g * 1000.0
    
    monthly_records.append({
        "date": m,
        "year": int(m.split('-')[0]),
        "month": int(m.split('-')[1]),
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
        }
    })

# 연간 데이터 (각 연도의 마지막 월 기준)
yearly_map = {}
for r in monthly_records:
    y = r["year"]
    yearly_map[y] = r

yearly_records = [yearly_map[y] for y in sorted(yearly_map.keys())]

# 2004년 기준 화폐 구매력 지수 계산 (2004-01 = 100%)
base_usd_g = monthly_records[0]["gold_usd"]["g"]
base_krw_g = monthly_records[0]["gold_krw"]["g"]

for r in monthly_records:
    r["fiat_power_usd"] = round((base_usd_g / r["gold_usd"]["g"]) * 100, 1)
    r["fiat_power_krw"] = round((base_krw_g / r["gold_krw"]["g"]) * 100, 1)

for r in yearly_records:
    r["fiat_power_usd"] = round((base_usd_g / r["gold_usd"]["g"]) * 100, 1)
    r["fiat_power_krw"] = round((base_krw_g / r["gold_krw"]["g"]) * 100, 1)

output_data = {
    "meta": {
        "title": "금 vs 실용화폐 23년 실물가치 변동 시계열 (2004~2026)",
        "source": "Yahoo Finance (GC=F, KRW=X)",
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

print(f"Saved {len(monthly_records)} monthly records and {len(yearly_records)} yearly records to {out_path}!")
print("2004-01 vs Latest comparison:")
first = monthly_records[0]
last = monthly_records[-1]
print(f"2004-01: 1don KRW={first['gold_krw']['don']:,}원, 1toz USD=${first['gold_usd']['toz']}, USD/KRW={first['usdkrw']}원")
print(f"Latest ({last['date']}): 1don KRW={last['gold_krw']['don']:,}원, 1toz USD=${last['gold_usd']['toz']}, USD/KRW={last['usdkrw']}원")
print(f"Gold 1don growth: {((last['gold_krw']['don'] - first['gold_krw']['don'])/first['gold_krw']['don'])*100:.1f}%")
print(f"USD purchasing power remaining: {last['fiat_power_usd']}% (하락: {100 - last['fiat_power_usd']}%)")
print(f"KRW purchasing power remaining: {last['fiat_power_krw']}% (하락: {100 - last['fiat_power_krw']}%)")
