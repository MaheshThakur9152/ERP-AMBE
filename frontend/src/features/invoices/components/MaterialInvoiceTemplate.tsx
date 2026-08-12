import React from 'react';
import { InvoiceData } from '../types/invoice';
import { computeMaterialCalculations } from '../utils/materialCalculator';
import { formatCurrency } from '../utils/invoiceCalculator';

interface MaterialInvoiceTemplateProps {
  data: InvoiceData;
  colorMode?: 'color' | 'bw';
}

export const MaterialInvoiceTemplate: React.FC<MaterialInvoiceTemplateProps> = ({
  data,
  colorMode = 'color',
}) => {
  const isBw = colorMode === 'bw';
  const sellerColor = isBw ? '#000000' : '#b91c1c';

  // Build material line items from data.items
  const materialItems = (data.items || []).map((item, idx) => ({
    srNo: idx + 1,
    description: item.description || '',
    hsnCode: item.hsnCode || '',
    gstRate: item.gstRate ?? 18,
    rate: item.rate ?? 0,
    quantity: item.quantity ?? 1,
    unit: item.unit || 'Nos',
    amount: item.amount ?? 0,
  }));

  // Compute financials using materialCalculator
  const calc = computeMaterialCalculations(
    materialItems.map((item) => ({
      id: String(item.srNo),
      srNo: item.srNo,
      description: item.description,
      hsnCode: item.hsnCode,
      gstRate: item.gstRate,
      rate: item.rate,
      quantity: item.quantity,
      unit: item.unit,
      amount: item.amount,
    }))
  );

  // Delivery details from meta or delivery object
  const delivery = data.delivery || {};
  const challanNo = delivery.challanNo || data.meta?.challanNo || '';
  const challanDate = delivery.challanDate || data.meta?.challanDate || '';
  const buyerOrderNo = delivery.buyerOrderNo || data.meta?.buyerOrderNo || '';
  const dispatchDocNo = delivery.dispatchDocNo || data.meta?.dispatchDocNo || '';
  const dispatchedThrough = delivery.dispatchedThrough || data.meta?.dispatchedThrough || '';
  const destination = delivery.destination || data.meta?.destination || '';
  const termsOfDelivery = delivery.termsOfDelivery || data.meta?.termsOfDelivery || '';
  const referenceNoDate = delivery.referenceNoDate || '';
  const otherReferences = delivery.otherReferences || '';
  const deliveryNotedDate = delivery.deliveryNotedDate || '';

  const docTitle =
    data.type === 'Proforma Invoice' || data.meta?.invoiceType === 'Proforma Invoice'
      ? 'PROFORMA INVOICE'
      : 'TAX INVOICE';

  const fontStyle: React.CSSProperties = { fontFamily: 'Arial, Helvetica, sans-serif' };
  const headerCellStyle: React.CSSProperties = { borderRight: '1px solid #000', padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' };
  const vertCellStyle: React.CSSProperties = { borderRight: '1px solid #000', padding: '2px 4px', fontSize: '10px' };
  const lastVertCellStyle: React.CSSProperties = { padding: '2px 4px', fontSize: '10px' };

  return (
    <div
      id="printable-invoice"
      className={`w-full flex flex-col items-center select-none text-black print:w-full print:max-w-none ${isBw ? 'grayscale' : ''}`}
      style={fontStyle}
    >
      {/* Document Title */}
      <div className="text-center font-normal text-[12pt] tracking-normal uppercase text-black mb-4 print:mb-3" style={fontStyle}>
        {docTitle}
      </div>

      {/* Outer border container */}
      <div className="w-full max-w-4xl bg-white text-black text-[10px] leading-tight shadow-2xl print:shadow-none print:max-w-none print:w-full" style={fontStyle}>
        <div className="border border-black w-full">

          {/* ===== TOP SECTION: Seller & Buyer Blocks with rowSpan ===== */}
          <table className="w-full border-collapse border-b border-black text-[10px]" style={{ tableLayout: 'fixed' }}>
            <tbody>
              {/* ===== SELLER BLOCK (Rows 1 to 4) ===== */}
              <tr>
                <td rowSpan={4} className="border-r border-black p-1.5 align-top" style={{ width: '55%' }}>
                  <h1 className="font-bold text-sm leading-snug" style={{ color: sellerColor }}>
                    {data.company.name || 'BHAGWATI ENTERPRISES'}
                  </h1>
                  <p className="mt-0.5">{data.company.addressLine1}</p>
                  <p>{data.company.addressLine2}</p>
                  {data.company.gstin && <p>GSTIN : {data.company.gstin}</p>}
                  {(data.company as any).stateNameCode && <p>{(data.company as any).stateNameCode}</p>}
                  <p>Contact No: {data.company.contactNo}</p>
                  <p>Email : {data.company.emailWebsite}</p>
                </td>
                <td className="border-r border-b border-black p-1 font-medium" style={{ width: '20%' }}>
                  Invoice No.: <span className="font-bold">{data.meta.invoiceNo}</span>
                </td>
                <td className="border-b border-black p-1 font-medium" style={{ width: '25%' }}>
                  Dated : <span className="font-bold">{data.meta.invoiceDate}</span>
                </td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Challan No :</td>
                <td className="border-b border-black p-1 font-bold">{challanNo}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Challan Date :</td>
                <td className="border-b border-black p-1 font-bold">{challanDate}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Reference No &amp; Date</td>
                <td className="border-b border-black p-1">{otherReferences || 'Other References'}</td>
              </tr>

              {/* ===== BUYER BLOCK (Rows 5 to 8) ===== */}
              <tr>
                <td rowSpan={4} className="border-r border-black p-1.5 align-top" style={{ width: '55%', borderTop: '1px solid #000' }}>
                  <p className="font-semibold text-[9px] uppercase text-gray-700">Buyer (Bill to)</p>
                  <p className="font-bold text-[11px] mt-0.5">{data.party.name}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[9.5px]">{data.party.address || data.party.siteName}</p>
                  {data.party.gstin && <p className="mt-0.5">GSTIN : {data.party.gstin}</p>}
                </td>
                <td className="border-r border-b border-black p-1">Buyer's Order No.</td>
                <td className="border-b border-black p-1">{buyerOrderNo || 'Dated'}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Dispatch Doc No.</td>
                <td className="border-b border-black p-1">{deliveryNotedDate || 'Delivery Noted Date'}</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Dispatched through</td>
                <td className="border-b border-black p-1">
                  <span className="font-medium">Destination : </span>
                  <span className="font-bold">{destination}</span>
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="p-1">
                  Terms of Delivery{termsOfDelivery ? `: ${termsOfDelivery}` : ''}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ===== LINE ITEMS TABLE ===== */}
          <table className="w-full border-collapse text-left border-b border-black" style={{ fontSize: '10px', tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-black">
                <th style={{ ...headerCellStyle, width: '5%', textAlign: 'center' }}>Sr No</th>
                <th style={{ ...headerCellStyle, width: '42%', textAlign: 'left' }}>Description of Goods</th>
                <th style={{ ...headerCellStyle, width: '10%', textAlign: 'center' }}>HSN/SAC</th>
                <th style={{ ...headerCellStyle, width: '7%', textAlign: 'center' }}>GST Rate</th>
                <th style={{ ...headerCellStyle, width: '9%', textAlign: 'right' }}>Rate</th>
                <th style={{ ...headerCellStyle, width: '8%', textAlign: 'center' }}>Quantity</th>
                <th style={{ ...headerCellStyle, width: '6%', textAlign: 'center' }}>per</th>
                <th style={{ padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', width: '13%', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {materialItems.map((item) => (
                <tr key={item.srNo} className="border-b border-black">
                  <td style={{ ...vertCellStyle, textAlign: 'center' }}>{item.srNo}</td>
                  <td style={vertCellStyle}>{item.description}</td>
                  <td style={{ ...vertCellStyle, textAlign: 'center' }}>{item.hsnCode}</td>
                  <td style={{ ...vertCellStyle, textAlign: 'center' }}>{item.gstRate}%</td>
                  <td style={{ ...vertCellStyle, textAlign: 'right' }}>{item.rate}</td>
                  <td style={{ ...vertCellStyle, textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ ...vertCellStyle, textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ ...lastVertCellStyle, textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                </tr>
              ))}

              {/* Seamless Filler Row */}
              <tr style={{ height: '300px' }}>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={lastVertCellStyle}></td>
              </tr>

              {/* Total Goods Amount (A) - Border Top */}
              <tr className="border-t border-black">
                <td style={vertCellStyle}></td>
                <td style={{ ...vertCellStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '8px' }}>Total Good's Amount (A)</td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={{ ...lastVertCellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(calc.goodsSubTotal)}</td>
              </tr>

              {/* Dynamic tax rows — CGST & SGST - Labels in Column 2 */}
              {calc.taxGroups.map((tg) => (
                <React.Fragment key={`tg-${tg.gstRate}`}>
                  <tr>
                    <td style={vertCellStyle}></td>
                    <td style={{ ...vertCellStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '8px' }}>CGST {tg.cgstRate}%</td>
                    <td style={vertCellStyle}></td>
                    <td style={vertCellStyle}></td>
                    <td style={vertCellStyle}></td>
                    <td style={{ ...vertCellStyle, textAlign: 'center', fontWeight: 'bold' }}>{tg.cgstRate}</td>
                    <td style={{ ...vertCellStyle, textAlign: 'center', fontWeight: 'bold' }}>%</td>
                    <td style={{ ...lastVertCellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(tg.cgstAmount)}</td>
                  </tr>
                  <tr>
                    <td style={vertCellStyle}></td>
                    <td style={{ ...vertCellStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '8px' }}>SGST {tg.sgstRate}%</td>
                    <td style={vertCellStyle}></td>
                    <td style={vertCellStyle}></td>
                    <td style={vertCellStyle}></td>
                    <td style={{ ...vertCellStyle, textAlign: 'center', fontWeight: 'bold' }}>{tg.sgstRate}</td>
                    <td style={{ ...vertCellStyle, textAlign: 'center', fontWeight: 'bold' }}>%</td>
                    <td style={{ ...lastVertCellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(tg.sgstAmount)}</td>
                  </tr>
                </React.Fragment>
              ))}

              {/* Total GST Amount (B) - 8 <td> layout */}
              <tr className="border-t border-black">
                <td style={vertCellStyle}></td>
                <td style={{ ...vertCellStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '8px' }}>Total GST Amount of Good's (B)</td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={{ ...lastVertCellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(calc.taxTotal)}</td>
              </tr>

              {/* TOTAL AMOUNT (A+B) - 8 <td> layout */}
              <tr className="border-t border-black">
                <td style={vertCellStyle}></td>
                <td style={{ ...vertCellStyle, textAlign: 'right', fontWeight: 'bold', fontSize: '11px', paddingRight: '8px' }}>TOTAL AMOUNT(A+B)</td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={vertCellStyle}></td>
                <td style={{ ...lastVertCellStyle, textAlign: 'right', fontWeight: 'bold', fontSize: '11px' }}>{calc.grandTotal.toLocaleString('en-IN')}</td>
              </tr>

              {/* Amount in Words */}
              <tr className="border-t border-black">
                <td colSpan={8} className="p-2">
                  Total Invoice Amount in words (INR) : <span className="font-bold ml-1">{calc.amountInWords}</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ===== FOOTER: Bank Details | Signatory ===== */}
          <div className="flex border-b border-black" style={{ alignItems: 'stretch' }}>
            {/* Left: Bank Details */}
            <div className="border-r border-black p-2 text-[9.5px]" style={{ flex: '0 0 55%' }}>
              <p className="font-semibold mb-1">Company's Bank Details:</p>
              <p>Bank Name: {data.bank.bankName}</p>
              <p>Acc No. : {data.bank.accountNo}</p>
              <p>Branch &amp; IFSC Code : {data.bank.branch} &amp; {data.bank.ifscCode}</p>
            </div>

            {/* Right: Authorized Signatory */}
            <div className="p-2 flex flex-col justify-between" style={{ flex: '0 0 45%' }}>
              <p className="text-right text-[10px] font-medium">For {data.company.name || 'BHAGWATI ENTERPRISES'}</p>
              <div className="text-right mt-8">
                <p className="text-[10px] text-gray-600 border-t border-gray-300 pt-1 inline-block pr-2">
                  Authorized Signatory
                </p>
              </div>
            </div>
          </div>

          {/* ===== UDYAM REGISTRATION ROW ===== */}
          <div className="p-1.5 text-xs font-bold">
            Udyam Reg. No : {(data.company as any)?.udyamNo || 'UDYAM-MH-18-0108068'}
          </div>

        </div>
      </div>
    </div>
  );
};
