/**
 * ==========================================================
 * 바이브 카페 (Vibe Cafe) - script.js
 * 1. Supabase 연동 (orders 테이블에 주문 저장)
 * 2. 실시간 주문 금액 계산 및 유효성 검사
 * 3. 주문 접수 및 주문 내역 배열(orders) 저장
 * 4. 탭 메뉴 전환 (주문하기 ↔ 주문 내역)
 * 5. 주문 내역 목록 렌더링, 개별 취소 및 전체 삭제 기능
 * ==========================================================
 */

// ----------------------------------------------------------
// [0] Supabase 설정 정보 (여기에 본인의 URL과 KEY를 입력해주세요)
// ----------------------------------------------------------
const SUPABASE_URL = 'https://xzviriqiwgjsylalvgnp.supabase.co'; // 예: 'https://xxxx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dmlyaXFpd2dqc3lsYWx2Z25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzAyNTYsImV4cCI6MjEwNjIwNjI1Nn0.r-FoVR2MHDnPnpCaSjgGyHQjMuyVrSK-y4iagPT1nlo'; // 본인의 anon public API 키

// CDN으로 로드된 supabase 라이브러리를 통해 클라이언트 생성
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// HTML 문서(DOM)가 모두 준비되면 코드를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {

  // ----------------------------------------------------------
  // [1] 전역 데이터 상태 관리
  // ----------------------------------------------------------
  const orders = [];        // 주문 목록을 저장할 배열
  let orderIdCounter = 1;   // 주문번호 (1부터 1씩 증가)

  // ----------------------------------------------------------
  // [2] 주요 HTML 요소(DOM) 가져오기
  // ----------------------------------------------------------
  // (1) 탭 메뉴 관련 요소
  const tabBtnOrder = document.getElementById('tabBtnOrder');           // "☕ 주문하기" 탭 버튼
  const tabBtnHistory = document.getElementById('tabBtnHistory');       // "📋 주문 내역" 탭 버튼
  const tabContentOrder = document.getElementById('tabContentOrder');   // 주문하기 탭 본문 영역
  const tabContentHistory = document.getElementById('tabContentHistory'); // 주문 내역 탭 본문 영역
  const orderBadge = document.getElementById('orderBadge');             // 주문 건수 배지

  // (2) 주문서 폼 관련 요소
  const orderForm = document.getElementById('orderForm');                 // 주문서 폼
  const userNameInput = document.getElementById('userName');             // 이름 입력
  const userPhoneInput = document.getElementById('userPhone');           // 전화번호 입력
  const beverageSelect = document.getElementById('beverage');            // 음료 선택 드롭다운
  const sizeRadios = document.querySelectorAll('input[name="size"]');     // 사이즈 라디오 버튼들
  const optionCheckboxes = document.querySelectorAll('input[name="extraOption"]'); // 추가 옵션 체크박스들
  const quantityInput = document.getElementById('quantity');             // 수량 입력
  const requestsInput = document.getElementById('requests');             // 요청사항 텍스트에어리어
  const estimatedPriceSpan = document.getElementById('estimatedPrice');  // 예상 금액 숫자 영역
  const orderConfirmation = document.getElementById('orderConfirmation'); // 주문 확인 메시지 박스
  const submitOrderBtn = document.getElementById('submitOrderBtn');       // 주문하기 버튼
  const resetBtn = document.getElementById('resetOrderBtn');             // 다시 작성 버튼

  // (3) 주문 내역 탭 관련 요소
  const orderList = document.getElementById('orderList');                 // 주문 카드들이 들어갈 목록 컨테이너
  const emptyOrderMessage = document.getElementById('emptyOrderMessage'); // "아직 주문 내역이 없어요" 메시지
  const historySummaryArea = document.getElementById('historySummaryArea'); // 하단 요약 영역
  const beverageSummaryText = document.getElementById('beverageSummaryText'); // "카페라떼 3잔, 아메리카노 1잔" 음료별 요약 텍스트
  const historySummaryText = document.getElementById('historySummaryText'); // "총 주문 금액: ...원 (...건)" 텍스트
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');       // 내역 모두 지우기 버튼

  // ----------------------------------------------------------
  // [3] 총 금액 계산 함수 (calculateTotal)
  // - 음료, 사이즈, 옵션, 수량을 반영하여 총 금액을 계산하고 화면에 반영
  // ----------------------------------------------------------
  function calculateTotal() {
    // 1) 선택된 음료 기본 가격 가져오기 (미선택 시 0원)
    const selectedBeverageOption = beverageSelect.options[beverageSelect.selectedIndex];
    const beveragePrice = Number(selectedBeverageOption?.dataset.price || 0);

    // [조건] 음료를 선택하지 않았다면 무조건 예상 금액은 0원
    if (!beverageSelect.value || beveragePrice === 0) {
      estimatedPriceSpan.textContent = '0';
      return 0;
    }

    // 2) 선택된 사이즈 추가 금액
    let sizePrice = 0;
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    if (selectedSizeRadio) {
      sizePrice = Number(selectedSizeRadio.dataset.price || 0);
    }

    // 3) 체크된 추가 옵션 금액 합산
    let optionsPrice = 0;
    const checkedOptions = document.querySelectorAll('input[name="extraOption"]:checked');
    checkedOptions.forEach((checkbox) => {
      optionsPrice += Number(checkbox.dataset.price || 0);
    });

    // 4) 수량 가져오기 (최소 1 이상)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // 5) 총 금액 = (음료 + 사이즈 + 옵션들) * 수량
    const totalPrice = (beveragePrice + sizePrice + optionsPrice) * quantity;

    // 6) 천 단위 콤마(toLocaleString) 적용 후 화면 갱신
    estimatedPriceSpan.textContent = totalPrice.toLocaleString();

    return totalPrice;
  }

  // ----------------------------------------------------------
  // [4] 실시간 입력 변경 이벤트 리스너 등록
  // ----------------------------------------------------------
  beverageSelect.addEventListener('change', calculateTotal);

  sizeRadios.forEach((radio) => {
    radio.addEventListener('change', calculateTotal);
  });

  optionCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', calculateTotal);
  });

  quantityInput.addEventListener('input', calculateTotal);
  quantityInput.addEventListener('change', calculateTotal);

  // ----------------------------------------------------------
  // [5] 주문 건수 배지 갱신 및 통통 튀는 애니메이션 함수
  // ----------------------------------------------------------
  function updateOrderBadge(shouldAnimate = false) {
    orderBadge.textContent = orders.length;

    // 주문 접수 시 배지가 통통 튀는 애니메이션 적용
    if (shouldAnimate) {
      orderBadge.classList.remove('bounce');
      void orderBadge.offsetWidth; // 브라우저 리플로우(Reflow) 강제로 연속 트리거 보장
      orderBadge.classList.add('bounce');
    }
  }

  // 애니메이션이 끝나면 bounce 클래스 제거
  orderBadge.addEventListener('animationend', () => {
    orderBadge.classList.remove('bounce');
  });


  // ----------------------------------------------------------
  // [6] 주문 내역 렌더링 함수 (renderOrders) - 단일 함수로 관리
  // - 보안을 위해 사용자 입력값은 innerHTML 대신 textContent로만 추가합니다.
  // ----------------------------------------------------------
  function renderOrders() {
    // 기존 카드 목록 비우기
    orderList.textContent = '';

    // 주문 내역이 하나도 없는 경우
    if (orders.length === 0) {
      emptyOrderMessage.classList.remove('hidden'); // "아직 주문 내역이 없어요" 보이기
      historySummaryArea.classList.add('hidden');    // 하단 요약 숨기기
      beverageSummaryText.textContent = '';         // 음료 요약 초기화
      return;
    }

    // 주문 내역이 있는 경우 안내 메시지 숨기고 요약 보이기
    emptyOrderMessage.classList.add('hidden');
    historySummaryArea.classList.remove('hidden');

    let totalAmount = 0;         // 총 주문 금액 누적 변수
    const beverageCounts = {};   // 음료별 판매 잔 수 집계 객체 (예: { '카페라떼': 3, '아메리카노': 1 })

    // 최신 주문부터 순회하며 카드 DOM 생성 및 수량 집계
    orders.forEach((order) => {
      totalAmount += order.totalPrice;

      // 음료별 판매 수량 누적
      beverageCounts[order.beverage] = (beverageCounts[order.beverage] || 0) + order.quantity;

      // 1) 카드 컨테이너 (<div class="order-card">)
      const card = document.createElement('div');
      card.className = 'order-card';

      // 2) 카드 오른쪽 상단 "취소" 버튼
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'card-cancel-btn';
      cancelBtn.textContent = '취소';

      // 취소 버튼 클릭 시: confirm 확인 후 해당 주문 삭제
      cancelBtn.addEventListener('click', () => {
        const isConfirmed = confirm(`#${order.id}번 주문(${order.name}님)을 취소하시겠습니까?`);
        if (isConfirmed) {
          // 해당 주문 찾아서 배열에서 제거
          const targetIndex = orders.findIndex((item) => item.id === order.id);
          if (targetIndex !== -1) {
            orders.splice(targetIndex, 1);
            updateOrderBadge();
            renderOrders(); // 화면 다시 그리기
          }
        }
      });

      // 3) 1번째 줄: "#1 홍길동님 · 5,000원"
      const row1 = document.createElement('div');
      row1.className = 'order-card-row1';
      row1.textContent = `#${order.id} ${order.name}님 · ${order.totalPrice.toLocaleString()}원`;

      // 4) 2번째 줄: "카페라떼 M사이즈 (샷 추가) 1잔"
      const row2 = document.createElement('div');
      row2.className = 'order-card-row2';
      const optionString = order.options.length > 0 ? ` (${order.options.join(', ')})` : '';
      row2.textContent = `${order.beverage} ${order.size}${optionString} ${order.quantity}잔`;

      // 5) 3번째 줄: 요청사항(있을 때만) · 주문 시간
      const row3 = document.createElement('div');
      row3.className = 'order-card-row3';
      if (order.requests) {
        row3.textContent = `${order.requests} · ${order.time}`;
      } else {
        row3.textContent = order.time;
      }

      // 카드 조립 (XSS 방지를 위해 모든 텍스트는 textContent로 안전하게 삽입됨)
      card.appendChild(cancelBtn);
      card.appendChild(row1);
      card.appendChild(row2);
      card.appendChild(row3);

      // 목록에 카드 추가
      orderList.appendChild(card);
    });

    // 음료별 집계 문자열 생성 (예: "카페라떼 3잔, 아메리카노 1잔")
    const beverageSummaryString = Object.entries(beverageCounts)
      .map(([beverage, count]) => `${beverage} ${count}잔`)
      .join(', ');

    // 하단 요약 문구 업데이트 (보안을 위해 textContent 사용)
    beverageSummaryText.textContent = beverageSummaryString;
    historySummaryText.textContent = `총 주문 금액: ${totalAmount.toLocaleString()}원 (${orders.length}건)`;
  }

  // ----------------------------------------------------------
  // [7] 탭 전환 이벤트 리스너
  // ----------------------------------------------------------
  // "☕ 주문하기" 탭 클릭 시
  tabBtnOrder.addEventListener('click', () => {
    tabBtnOrder.classList.add('active');
    tabBtnHistory.classList.remove('active');

    tabContentOrder.classList.remove('hidden');
    tabContentHistory.classList.add('hidden');
  });

  // "📋 주문 내역" 탭 클릭 시
  tabBtnHistory.addEventListener('click', () => {
    tabBtnHistory.classList.add('active');
    tabBtnOrder.classList.remove('active');

    tabContentHistory.classList.remove('hidden');
    tabContentOrder.classList.add('hidden');

    // 주문 내역 화면 최신화
    renderOrders();
  });

  // ----------------------------------------------------------
  // [8] "주문하기" 버튼 클릭(폼 submit) 처리 & Supabase 데이터베이스 저장
  // ----------------------------------------------------------
  orderForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // 기본 폼 새로고침 방지

    // 1) 이름 유효성 검사
    const userName = userNameInput.value.trim();
    if (!userName) {
      alert('이름을 입력해주세요');
      userNameInput.focus();
      return;
    }

    // 2) 음료 선택 유효성 검사
    if (!beverageSelect.value) {
      alert('음료를 선택해주세요');
      beverageSelect.focus();
      return;
    }

    // [중복 클릭 방지] 저장하는 동안 주문하기 버튼 비활성화
    submitOrderBtn.disabled = true;
    const originalBtnText = submitOrderBtn.textContent;
    submitOrderBtn.textContent = '주문 처리 중...';

    try {
      // 3) 주문 정보 추출
      // 순수 음료명 ("카페라떼 (4,000원)" -> "카페라떼") 및 음료 기본 가격
      const selectedOption = beverageSelect.options[beverageSelect.selectedIndex];
      const rawBeverageText = selectedOption.textContent;
      const beverageName = rawBeverageText.split(' (')[0].trim();
      const beveragePrice = Number(selectedOption.dataset.price || 0);

      // 사이즈 값 ("M") 및 화면 표시용 이름 ("M사이즈")
      const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
      const sizeValue = selectedSizeRadio ? selectedSizeRadio.value : 'M';
      const sizeName = `${sizeValue}사이즈`;

      // 체크된 옵션명 목록을 배열로 수집 (예: ['샷 추가', '크림 추가'])
      const checkedOptions = document.querySelectorAll('input[name="extraOption"]:checked');
      const optionNames = [];
      checkedOptions.forEach((checkbox) => {
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        if (label) {
          const cleanOptionName = label.textContent.split(' (')[0].trim();
          optionNames.push(cleanOptionName);
        }
      });

      // 수량, 요청사항, 전화번호, 총 결제 금액
      const quantity = parseInt(quantityInput.value, 10) || 1;
      const requests = requestsInput.value.trim();
      const phone = userPhoneInput.value.trim();
      const finalTotal = calculateTotal();

      // 4) Supabase orders 테이블에 주문 데이터 저장
      if (!supabaseClient) {
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다. SUPABASE_URL과 SUPABASE_KEY를 확인해주세요.');
      }

      // orders 테이블에 한 줄(row) 삽입
      const { data, error } = await supabaseClient
        .from('orders')
        .insert([
          {
            customer_name: userName,        // 손님 이름
            phone: phone,                    // 전화번호
            drink: beverageName,             // 음료명
            drink_price: beveragePrice,      // 음료 기본 가격 (숫자)
            size: sizeValue,                 // 사이즈 ('S', 'M', 'L')
            options: optionNames,            // 추가 옵션 (문자열 배열)
            quantity: quantity,              // 수량 (숫자)
            request: requests,               // 요청사항
            total_price: finalTotal          // 총 금액 (숫자)
          }
        ])
        .select();

      // Supabase 에러 발생 시 catch 블록으로 이동
      if (error) {
        throw error;
      }

      // 5) [저장 성공 시] 로컬 주문 내역(배열)에 추가 및 확인 메시지 표시
      const now = new Date();
      const orderTime = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // DB에서 발급된 id가 있으면 사용, 없으면 로컬 카운터 사용
      const orderId = (data && data[0] && data[0].id) ? data[0].id : orderIdCounter++;

      const newOrder = {
        id: orderId,
        name: userName,
        beverage: beverageName,
        size: sizeName,
        options: optionNames,
        quantity: quantity,
        requests: requests,
        totalPrice: finalTotal,
        time: orderTime
      };

      // 최신 주문을 목록 맨 앞에 추가
      orders.unshift(newOrder);

      // 주문 건수 배지 갱신 (통통 튀는 애니메이션 실행: true)
      updateOrderBadge(true);

      // 주문 확인 메시지 구성 (옵션 유무에 따라 괄호 처리)
      let optionText = '';
      if (optionNames.length > 0) {
        optionText = ` (${optionNames.join(', ')})`;
      }

      const confirmationMessage = `${userName}님, ${beverageName} ${sizeName}${optionText} ${quantity}잔, 총 ${finalTotal.toLocaleString()}원 주문이 접수되었습니다!`;

      // 화면에 주문 접수 확인 메시지 노출
      orderConfirmation.textContent = confirmationMessage;
      orderConfirmation.classList.remove('hidden');

      // 확인 메시지 영역으로 부드럽게 스크롤
      orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
      // 6) [저장 실패 시] 콘솔 에러 출력 및 알림창 띄우기
      console.error('주문 저장 실패 상세 에러:', error);
      alert('주문 저장에 실패했어요');
    } finally {
      // 7) 주문 처리가 완료되면 버튼 다시 활성화
      submitOrderBtn.disabled = false;
      submitOrderBtn.textContent = originalBtnText;
    }
  });

  // ----------------------------------------------------------
  // [9] "다시 작성" 버튼 (reset) 처리
  // - 주문서 입력 내용만 초기화하고, 주문 내역(orders)은 지우지 않습니다.
  // ----------------------------------------------------------
  orderForm.addEventListener('reset', () => {
    setTimeout(() => {
      // 1) 기본값 복원: M 사이즈 선택, 수량 1
      const defaultSizeRadio = document.getElementById('sizeM');
      if (defaultSizeRadio) {
        defaultSizeRadio.checked = true;
      }
      quantityInput.value = '1';

      // 2) 예상 금액 0원으로 재계산
      calculateTotal();

      // 3) 주문 확인 메시지 숨기기
      orderConfirmation.textContent = '';
      orderConfirmation.classList.add('hidden');
    }, 0);
  });

  // ----------------------------------------------------------
  // [10] "내역 모두 지우기" 버튼 처리
  // ----------------------------------------------------------
  clearHistoryBtn.addEventListener('click', () => {
    if (orders.length === 0) return;

    const isConfirmed = confirm('주문 내역을 모두 지우시겠습니까?');
    if (isConfirmed) {
      // 배열 초기화
      orders.length = 0;
      updateOrderBadge();
      renderOrders();
    }
  });

  // ----------------------------------------------------------
  // [11] 초기 실행: 금액 0원 세팅 및 배지 초기화
  // ----------------------------------------------------------
  calculateTotal();
  updateOrderBadge();

});
