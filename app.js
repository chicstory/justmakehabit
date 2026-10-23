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
function calculateSalary() {
  const joinDateVal = document.getElementById('joinDate')?.value || '2026-10-12';
  const totalMonthlySalary = parseInt(document.getElementById('monthlySalary')?.value || '2900000', 10);
  const nonTaxFood = parseInt(document.getElementById('nonTaxFood')?.value || '200000', 10);
  const scheme = document.getElementById('workDaysScheme')?.value || 'calendar';

  const joinDate = new Date(joinDateVal);
  if (isNaN(joinDate.getTime())) return;

  const year = joinDate.getFullYear();
  const month = joinDate.getMonth(); // 0-indexed (9 = 10월)
  const joinDay = joinDate.getDate();

  // 해당 월의 총 일수 (10월: 31일)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 입사일부터 말일까지의 재직 일수
  const tenureDays = daysInMonth - joinDay + 1;

  let ratio = 1;
  let daysInfoText = '';

  if (scheme === 'calendar') {
    ratio = tenureDays / daysInMonth;
    daysInfoText = `${month + 1}월 ${daysInMonth}일 중 ${tenureDays}일 근무 (${(ratio * 100).toFixed(1)}% 반영)`;
  } else {
    // 실제 소정근로일수 기준 (일~목 주 5일)
    let totalWorkDays = 0;
    let actualWorkDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = new Date(year, month, d).getDay(); // 0:일, 1:월, 2:화, 3:수, 4:목, 5:금, 6:토
      const isWorkDay = (dayOfWeek >= 0 && dayOfWeek <= 4); // 일~목
      if (isWorkDay) {
        totalWorkDays++;
        if (d >= joinDay) actualWorkDays++;
      }
    }
    ratio = totalWorkDays > 0 ? (actualWorkDays / totalWorkDays) : 1;
    daysInfoText = `총 소정근로 ${totalWorkDays}일 중 ${actualWorkDays}일 근무 (${(ratio * 100).toFixed(1)}% 반영)`;
  }

  // 1) 세전 일할 총액 산출 (총액에서 20만 원이 중복으로 더해지지 않음!)
  const grossPay = Math.floor(totalMonthlySalary * ratio);
  const proRatedNonTax = Math.floor(nonTaxFood * ratio);
  // 과세 대상 = 세전 일할 총액 - 비과세 식대 일할분
  const proRatedTaxable = Math.max(0, grossPay - proRatedNonTax);

  // 2) 4대 보험 법정 요율 (근로자 부담분)
  // 국민연금: 4.5% (월 도중 입사 시 유예 가능하나 보수적 산정)
  const nps = Math.floor(proRatedTaxable * 0.045);
  // 건강보험: 3.545%
  const nhi = Math.floor(proRatedTaxable * 0.03545);
  // 장기요양보험: 건강보험료의 12.95%
  const ltc = Math.floor(nhi * 0.1295);
  // 고용보험: 0.9%
  const ei = Math.floor(proRatedTaxable * 0.009);

  // 3) 간이세액표 약식 근로소득세 & 지방소득세
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

  // DOM 갱신
  document.getElementById('resNetPay').textContent = netPay.toLocaleString('ko-KR');
  document.getElementById('resGrossPay').textContent = grossPay.toLocaleString('ko-KR') + '원';
  document.getElementById('resTotalDeduct').textContent = '-' + totalDeduction.toLocaleString('ko-KR') + '원';
  document.getElementById('resDaysInfo').textContent = daysInfoText;

  document.getElementById('resNps').textContent = nps.toLocaleString('ko-KR') + '원';
  document.getElementById('resNhi').textContent = nhi.toLocaleString('ko-KR') + '원';
  document.getElementById('resLtc').textContent = ltc.toLocaleString('ko-KR') + '원';
  document.getElementById('resEi').textContent = ei.toLocaleString('ko-KR') + '원';
  document.getElementById('resTax').textContent = totalTax.toLocaleString('ko-KR') + '원';
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
