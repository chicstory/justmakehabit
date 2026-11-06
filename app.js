/**
 * justmakehabit - Main Application Logic
 * 1. View Switcher (yellow.kr LNB style)
 * 2. Mid-month Salary & Net Pay Calculator (중도입사 계산기)
 * 3. Client-side Comment & Guestbook System (Local Storage)
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  calculateSalary(); // 초기 로드 시 10월 12일 입사 기준 계산 실행
  loadComments();
  fetchMacroData();  // 실시간 거시 경제 지표 자동 연동
  fetchHoldingData(); // 실전 자산 매매 현황 연동
});

/* ===================================================
   0. 거시 경제 지표 데일리 연동 (ThePathLab 아침 브리핑 동기화)
   =================================================== */
function fetchMacroData() {
  const dateElem = document.getElementById('macroDate');
  const usdElem = document.getElementById('macroUsdKrw');

  // 1. ThePathLab 공식 latest.json 아침 브리핑 우선 연동
  fetch('https://chicstory.github.io/metals/latest.json')
    .then(res => res.json())
    .then(data => {
      if (data) {
        if (data.usd_rate && usdElem) {
          const rateNum = Number(data.usd_rate);
          usdElem.textContent = `${rateNum.toLocaleString('ko-KR')}원`;
        }
        if (dateElem && data.latest_date) {
          const parts = data.latest_date.split('-');
          if (parts.length === 3) {
            dateElem.textContent = `${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일 기준`;
          } else {
            dateElem.textContent = `${data.latest_date} 기준`;
          }
        }
      }
    })
    .catch(() => {
      // 2. 오픈 마켓 환율 API 백업 (CORS 지원)
      fetch('https://open.er-api.com/v6/latest/USD')
        .then(res => res.json())
        .then(data => {
          if (data && data.rates && data.rates.KRW && usdElem) {
            const rate = Math.round(data.rates.KRW * 10) / 10;
            usdElem.textContent = `${rate.toLocaleString('ko-KR')}원`;
          }
          if (dateElem) {
            const now = new Date();
            dateElem.textContent = `${now.getMonth() + 1}월 ${now.getDate()}일 기준`;
          }
        })
        .catch(() => {
          // 실패 시 HTML 정적 기본값 유지 (10월 24일 기준 / 1,338.4원)
        });
    });
}


/* ===================================================
   0-1. 실전 자산 매매 현황 동기화 (ROOT & FLNC 바벨 포트폴리오)
   =================================================== */
function fetchHoldingData() {
  const rootPriceElem = document.getElementById('rootCurPrice');
  const rootRetElem = document.getElementById('rootRetPct');
  const flncPriceElem = document.getElementById('flncCurPrice');
  const flncRetElem = document.getElementById('flncRetPct');
  const weightText = document.getElementById('holdingWeightText');
  const rootBar = document.getElementById('rootBarFill');
  const flncBar = document.getElementById('flncBarFill');

  // 실전 포트폴리오 매입 원장 (2026.11 실측)
  const portfolio = {
    ROOT: { buyPrice: 43.30, qty: 30, curPrice: 43.34 },
    FLNC: { buyPrice: 5.9476, qty: 120, curPrice: 5.11 }
  };

  fetch('radar/radar_data.json?v=' + Date.now())
    .then(res => res.json())
    .then(data => {
      if (data) {
        // ROOT (1부 리그 PLM100)
        if (data.plm100_items) {
          const rootItem = data.plm100_items.find(i => i.ticker === 'ROOT');
          if (rootItem && rootItem.price) {
            portfolio.ROOT.curPrice = rootItem.price;
          }
        }
        // FLNC (2부 리그 PLV100)
        if (data.plv100_items) {
          const flncItem = data.plv100_items.find(i => i.ticker === 'FLNC');
          if (flncItem && flncItem.price) {
            portfolio.FLNC.curPrice = flncItem.price;
          }
        }

        // ROOT 렌더링
        if (rootPriceElem && rootRetElem) {
          const rCur = portfolio.ROOT.curPrice;
          const rBuy = portfolio.ROOT.buyPrice;
          const rRet = ((rCur - rBuy) / rBuy) * 100;
          rootPriceElem.textContent = '$' + rCur.toFixed(2);
          rootRetElem.textContent = (rRet >= 0 ? '+' : '') + rRet.toFixed(1) + '%';
          rootRetElem.className = 'hp-val ' + (rRet >= 0 ? 'ret-up' : 'ret-down');
        }

        // FLNC 렌더링
        if (flncPriceElem && flncRetElem) {
          const fCur = portfolio.FLNC.curPrice;
          const fBuy = portfolio.FLNC.buyPrice;
          const fRet = ((fCur - fBuy) / fBuy) * 100;
          flncPriceElem.textContent = '$' + fCur.toFixed(2);
          flncRetElem.textContent = (fRet >= 0 ? '+' : '') + fRet.toFixed(1) + '%';
          flncRetElem.className = 'hp-val ' + (fRet >= 0 ? 'ret-up' : 'ret-down');
        }

        // 포트폴리오 평가금액 및 배분 비중 자동 계산
        const rootEval = portfolio.ROOT.curPrice * portfolio.ROOT.qty;
        const flncEval = portfolio.FLNC.curPrice * portfolio.FLNC.qty;
        const totalEval = rootEval + flncEval;

        if (totalEval > 0) {
          const rootWeight = Math.round((rootEval / totalEval) * 100);
          const flncWeight = 100 - rootWeight;

          if (weightText) {
            weightText.textContent = `ROOT ${rootWeight}% · FLNC ${flncWeight}%`;
          }
          if (rootBar) rootBar.style.width = rootWeight + '%';
          if (flncBar) flncBar.style.width = flncWeight + '%';
        }
      }
    })
    .catch(err => {
      console.log('radar_data.json 로드 대기 중 (정적 기본값 유지):', err);
    });
}

/* ===================================================
   1. 뷰 전환 및 내비게이션
   =================================================== */
function switchView(viewName) {
  // 모바일 메뉴 닫기
  const sidebar = document.getElementById('sidebarLeft');
  if (sidebar) sidebar.classList.remove('mobile-open');

  // 모든 뷰 숨김
  const views = document.querySelectorAll('.content-view');
  views.forEach(v => v.classList.remove('active'));

  // LNB 활성 상태 갱신
  const navItems = document.querySelectorAll('.nav-items li');
  navItems.forEach(li => li.classList.remove('active'));

  let targetId = 'view-' + viewName;
  if (viewName === 'home') targetId = 'view-article-balance';

  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 계산기 뷰로 이동 시 재계산 트리거
  if (viewName === 'calc-salary') {
    calculateSalary();
  }
}

function toggleNavGroup(headerElem) {
  const group = headerElem.closest('.nav-group');
  if (group) {
    group.classList.toggle('open');
  }
}

function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebarLeft');
  if (btn && sidebar) {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }
}

/* ===================================================
   2. 중도입사 급여/세후 실수령액 정밀 계산 엔진
   =================================================== */
/* ===================================================
   2. 급여/세후 실수령액 정밀 계산 엔진 (지속근무 vs 중도입사)
   =================================================== */
function setWorkType(type) {
  const input = document.getElementById('workType');
  const btnReg = document.getElementById('btnRegular');
  const btnMid = document.getElementById('btnMid');
  const midSec = document.getElementById('midHireSection');

  if (input) input.value = type;

  if (type === 'regular') {
    if (btnReg) btnReg.classList.add('active');
    if (btnMid) btnMid.classList.remove('active');
    if (midSec) midSec.style.display = 'none';
  } else {
    if (btnMid) btnMid.classList.add('active');
    if (btnReg) btnReg.classList.remove('active');
    if (midSec) midSec.style.display = 'block';
  }

  calculateSalary();
}

function calculateSalary() {
  const workType = document.getElementById('workType')?.value || 'regular';
  const totalMonthlySalary = parseInt(document.getElementById('monthlySalary')?.value || '2900000', 10);
  const nonTaxFood = parseInt(document.getElementById('nonTaxFood')?.value || '200000', 10);

  let ratio = 1;
  let daysInfoText = '한 달 전체 100% 만근 (정규 월급)';
  let grossLabel = '월 세전 총급여';

  if (workType === 'mid') {
    grossLabel = '중도입사 세전 총액';
    const joinDateVal = document.getElementById('joinDate')?.value || '2026-10-12';
    const scheme = document.getElementById('workDaysScheme')?.value || 'calendar';
    const joinDate = new Date(joinDateVal);

    if (!isNaN(joinDate.getTime())) {
      const year = joinDate.getFullYear();
      const month = joinDate.getMonth();
      const joinDay = joinDate.getDate();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const tenureDays = daysInMonth - joinDay + 1;

      if (scheme === 'calendar') {
        ratio = tenureDays / daysInMonth;
        daysInfoText = `${month + 1}월 ${daysInMonth}일 중 ${tenureDays}일 근무 (${(ratio * 100).toFixed(1)}% 반영)`;
      } else {
        // 일~목 물류 스케줄
        let totalWorkDays = 0;
        let actualWorkDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dayOfWeek = new Date(year, month, d).getDay();
          if (dayOfWeek >= 0 && dayOfWeek <= 4) {
            totalWorkDays++;
            if (d >= joinDay) actualWorkDays++;
          }
        }
        ratio = totalWorkDays > 0 ? (actualWorkDays / totalWorkDays) : 1;
        daysInfoText = `총 소정근로 ${totalWorkDays}일 중 ${actualWorkDays}일 근무 (${(ratio * 100).toFixed(1)}% 반영)`;
      }
    }
  }

  // 1) 세전 일할 총액 및 과세 대상
  const grossPay = Math.floor(totalMonthlySalary * ratio);
  const proRatedNonTax = Math.floor(nonTaxFood * ratio);
  const proRatedTaxable = Math.max(0, grossPay - proRatedNonTax);

  // 2) 4대 보험 공제 로직
  let nps = 0;
  let nhi = 0;
  let ltc = 0;
  const ei = Math.floor(proRatedTaxable * 0.009); // 고용보험 0.9%

  if (workType === 'regular') {
    // 지속근무: 정상 4대 보험 전액 공제
    nps = Math.floor(proRatedTaxable * 0.045);
    nhi = Math.floor(proRatedTaxable * 0.03545);
    ltc = Math.floor(nhi * 0.1295);
  } else {
    // 중도입사: 첫 달 공제 옵션 분기
    const insuranceScheme = document.getElementById('insuranceScheme')?.value || 'exempt_all';
    if (insuranceScheme === 'full') {
      nps = Math.floor(proRatedTaxable * 0.045);
      nhi = Math.floor(proRatedTaxable * 0.03545);
      ltc = Math.floor(nhi * 0.1295);
    } else if (insuranceScheme === 'exempt_nps') {
      nps = 0;
      nhi = Math.floor(proRatedTaxable * 0.03545);
      ltc = Math.floor(nhi * 0.1295);
    } else {
      nps = 0;
      nhi = 0;
      ltc = 0;
    }
  }

  // 3) 간이세액표 근로소득세 & 지방소득세
  let estIncomeTax = 0;
  if (proRatedTaxable > 1060000) {
    if (proRatedTaxable < 2000000) {
      estIncomeTax = Math.floor((proRatedTaxable - 1060000) * 0.03);
    } else if (proRatedTaxable < 3000000) {
      estIncomeTax = Math.floor(28200 + (proRatedTaxable - 2000000) * 0.06);
    } else {
      estIncomeTax = Math.floor(88200 + (proRatedTaxable - 3000000) * 0.15);
    }
  }
  const localTax = Math.floor(estIncomeTax * 0.10);
  const totalTax = estIncomeTax + localTax;

  // 4) 총 공제액 및 세후 실수령액
  const totalDeduction = nps + nhi + ltc + ei + totalTax;
  const netPay = Math.max(0, grossPay - totalDeduction);

  // 5) 비율(%) 계산 (급여 총액 대비 각 항목 점유율)
  const calcShare = (val) => grossPay > 0 ? (val / grossPay * 100).toFixed(1) + '%' : '0.0%';
  const deductRatio = grossPay > 0 ? (totalDeduction / grossPay * 100).toFixed(1) : '0.0';
  const netRatio = (100 - parseFloat(deductRatio)).toFixed(1);

  // DOM 갱신: 금액
  const netPayElem = document.getElementById('resNetPay');
  if (netPayElem) netPayElem.textContent = netPay.toLocaleString('ko-KR') + '원';

  const grossPayElem = document.getElementById('resGrossPay');
  if (grossPayElem) grossPayElem.textContent = grossPay.toLocaleString('ko-KR') + '원';

  const grossLabelElem = document.getElementById('resGrossLabel');
  if (grossLabelElem) grossLabelElem.textContent = grossLabel;

  const totalDeductElem = document.getElementById('resTotalDeduction') || document.getElementById('resTotalDeduct');
  if (totalDeductElem) totalDeductElem.textContent = '-' + totalDeduction.toLocaleString('ko-KR') + '원';

  const daysInfoElem = document.getElementById('resDaysInfo');
  if (daysInfoElem) daysInfoElem.textContent = daysInfoText;

  const npsElem = document.getElementById('resNps');
  if (npsElem) npsElem.textContent = nps === 0 ? '0원 (당월 미부과)' : nps.toLocaleString('ko-KR') + '원';

  const nhiElem = document.getElementById('resNhi');
  if (nhiElem) nhiElem.textContent = nhi === 0 ? '0원 (당월 미부과)' : nhi.toLocaleString('ko-KR') + '원';

  const ltcElem = document.getElementById('resLtc');
  if (ltcElem) ltcElem.textContent = ltc === 0 ? '0원 (당월 미부과)' : ltc.toLocaleString('ko-KR') + '원';

  const eiElem = document.getElementById('resEi');
  if (eiElem) eiElem.textContent = ei.toLocaleString('ko-KR') + '원';

  const taxElem = document.getElementById('resTax');
  if (taxElem) taxElem.textContent = totalTax.toLocaleString('ko-KR') + '원';

  // DOM 갱신: 비율 및 시각화 바
  const netRatioElem = document.getElementById('resNetRatio');
  if (netRatioElem) netRatioElem.textContent = netRatio + '%';

  const deductRatioElem = document.getElementById('resDeductRatio');
  if (deductRatioElem) deductRatioElem.textContent = deductRatio + '%';

  const prbNetFill = document.getElementById('prbNetFill');
  if (prbNetFill) prbNetFill.style.width = netRatio + '%';

  const prbDeductFill = document.getElementById('prbDeductFill');
  if (prbDeductFill) prbDeductFill.style.width = deductRatio + '%';

  const npsShareElem = document.getElementById('resNpsShare');
  if (npsShareElem) npsShareElem.textContent = nps === 0 ? '0.0%' : calcShare(nps);

  const nhiShareElem = document.getElementById('resNhiShare');
  if (nhiShareElem) nhiShareElem.textContent = nhi === 0 ? '0.0%' : calcShare(nhi);

  const ltcShareElem = document.getElementById('resLtcShare');
  if (ltcShareElem) ltcShareElem.textContent = ltc === 0 ? '0.0%' : calcShare(ltc);

  const eiShareElem = document.getElementById('resEiShare');
  if (eiShareElem) eiShareElem.textContent = calcShare(ei);

  const taxShareElem = document.getElementById('resTaxShare');
  if (taxShareElem) taxShareElem.textContent = calcShare(totalTax);

  const totalDeductShareElem = document.getElementById('resTotalDeductShare');
  if (totalDeductShareElem) totalDeductShareElem.textContent = deductRatio + '%';
}

/* ===================================================
   3. 댓글 & 방명록 로컬스토리지 시스템
   =================================================== */
function submitComment() {
  const authorInput = document.getElementById('commentAuthor');
  const contentInput = document.getElementById('commentContent');

  const author = authorInput?.value.trim() || '익명';
  const content = contentInput?.value.trim();

  if (!content) {
    alert('댓글 내용을 입력해주세요.');
    return;
  }

  const comment = {
    author,
    content,
    date: new Date().toISOString().split('T')[0]
  };

  const stored = JSON.parse(localStorage.getItem('jmh_comments') || '[]');
  stored.unshift(comment);
  localStorage.setItem('jmh_comments', JSON.stringify(stored));

  if (contentInput) contentInput.value = '';
  loadComments();
}

function loadComments() {
  const list = document.getElementById('commentList');
  if (!list) return;

  const stored = JSON.parse(localStorage.getItem('jmh_comments') || '[]');
  if (stored.length === 0) {
    list.innerHTML = `<div class="empty-comment">첫 번째 댓글의 주인공이 되어보세요!</div>`;
    return;
  }

  list.innerHTML = stored.map(c => `
    <div class="comment-item">
      <div class="c-head">
        <strong>${escapeHtml(c.author)}</strong>
        <span>${c.date}</span>
      </div>
      <p>${escapeHtml(c.content)}</p>
    </div>
  `).join('');

  const countElem = document.querySelector('.comment-count');
  if (countElem) {
    countElem.textContent = `${stored.length}개의 댓글`;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
