// ===============================================
// 최소 XLSX 생성기 (외부 라이브러리 없음)
//  - 「점검사항_조치현황」 양식과 동일한 서식의 엑셀 파일을 만듭니다.
//  - window.makeReportXlsx(rows, title) → Blob
// ===============================================
(function () {

  // ---------- ZIP (무압축 store 방식) ----------
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = enc.encode(f.text);
      const crc = crc32(data);

      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);   // UTF-8 파일명
      lv.setUint16(8, 0, true);        // 무압축
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      local.set(name, 30);
      parts.push(local, data);

      const cd = new Uint8Array(46 + name.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      cd.set(name, 46);
      central.push(cd);

      offset += local.length + data.length;
    });

    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    return new Blob([...parts, ...central, end], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  // ---------- XLSX 구성 ----------
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/\r?\n/g, "&#10;");

  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  const CONTENT_TYPES = XML +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    "</Types>";

  const RELS = XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
    "</Relationships>";

  const WB_RELS = XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>` +
    "</Relationships>";

  const WORKBOOK = XML +
    `<workbook xmlns="${NS}" xmlns:r="${REL}">` +
    '<sheets><sheet name="점검사항 조치현황" sheetId="1" r:id="rId1"/></sheets>' +
    "</workbook>";

  // s=1 제목 / s=2 머리글 / s=3 가운데정렬 본문 / s=4 왼쪽정렬 줄바꿈 본문
  const STYLES = XML +
    `<styleSheet xmlns="${NS}">` +
    '<fonts count="3">' +
      '<font><sz val="11"/><name val="맑은 고딕"/></font>' +
      '<font><b/><sz val="16"/><name val="맑은 고딕"/></font>' +
      '<font><b/><sz val="11"/><name val="맑은 고딕"/></font>' +
    "</fonts>" +
    '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>' +
    "</fills>" +
    '<borders count="2">' +
      "<border><left/><right/><top/><bottom/><diagonal/></border>" +
      '<border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right>' +
      '<top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>' +
    "</borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>' +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="표준" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  const COL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const HEADERS = ["순번", "점검사항", "발생위치", "발생일시", "조치일", "담당부서", "담당자", "비고"];

  function cell(ref, style, value) {
    if (value === "" || value === null || value === undefined) {
      return `<c r="${ref}" s="${style}"/>`;
    }
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  }

  /**
   * rows: [[순번, 점검사항, 발생위치, 발생일시, 조치일, 담당부서, 담당자, 비고], ...]
   * title: 제목행 문구
   */
  function makeReportXlsx(rows, title) {
    const lastRow = rows.length + 2;
    const body = [];

    // 1행: 제목 (A1:H1 병합)
    body.push(
      '<row r="1" ht="30" customHeight="1">' +
      COL_LETTERS.map((c) => cell(c + "1", 1, c === "A" ? title : "")).join("") +
      "</row>"
    );

    // 2행: 머리글
    body.push(
      '<row r="2" ht="22" customHeight="1">' +
      COL_LETTERS.map((c, i) => cell(c + "2", 2, HEADERS[i])).join("") +
      "</row>"
    );

    // 3행~: 데이터 (점검사항 열만 왼쪽정렬 + 줄바꿈)
    rows.forEach((r, i) => {
      const n = i + 3;
      body.push(
        `<row r="${n}">` +
        COL_LETTERS.map((c, j) => cell(c + n, j === 1 ? 4 : 3, r[j])).join("") +
        "</row>"
      );
    });

    const sheet = XML +
      `<worksheet xmlns="${NS}">` +
      `<dimension ref="A1:H${lastRow}"/>` +
      '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
      '<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>' +
      "</sheetView></sheetViews>" +
      '<sheetFormatPr defaultRowHeight="16.5"/>' +
      "<cols>" +
        '<col min="1" max="1" width="6" customWidth="1"/>' +
        '<col min="2" max="2" width="50" customWidth="1"/>' +
        '<col min="3" max="3" width="22" customWidth="1"/>' +
        '<col min="4" max="6" width="12" customWidth="1"/>' +
        '<col min="7" max="7" width="14" customWidth="1"/>' +
        '<col min="8" max="8" width="18" customWidth="1"/>' +
      "</cols>" +
      `<sheetData>${body.join("")}</sheetData>` +
      '<mergeCells count="1"><mergeCell ref="A1:H1"/></mergeCells>' +
      "</worksheet>";

    return zip([
      { name: "[Content_Types].xml", text: CONTENT_TYPES },
      { name: "_rels/.rels", text: RELS },
      { name: "xl/workbook.xml", text: WORKBOOK },
      { name: "xl/_rels/workbook.xml.rels", text: WB_RELS },
      { name: "xl/styles.xml", text: STYLES },
      { name: "xl/worksheets/sheet1.xml", text: sheet }
    ]);
  }

  window.makeReportXlsx = makeReportXlsx;
})();
