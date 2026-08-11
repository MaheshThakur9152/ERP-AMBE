const singleDigits = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const tensDigits = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertLessThanThousand(n: number): string {
  if (n === 0) return '';
  let str = '';
  if (n >= 100) {
    str += singleDigits[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += tensDigits[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    str += singleDigits[n] + ' ';
  }
  return str.trim();
}

/**
 * Converts a numeric amount to Indian Rupee Words format
 * e.g., 80367 -> "Eighty Thousand Three Hundred And Sixty Seven Only"
 */
export function numberToIndianWords(num: number): string {
  if (isNaN(num) || num === 0) return 'Zero Only';

  const rounded = Math.round(num);
  let n = Math.abs(rounded);

  const crore = Math.floor(n / 10000000);
  n %= 10000000;

  const lakh = Math.floor(n / 100000);
  n %= 100000;

  const thousand = Math.floor(n / 1000);
  n %= 1000;

  const remaining = n;

  let parts: string[] = [];

  if (crore > 0) {
    parts.push(`${convertLessThanThousand(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${convertLessThanThousand(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${convertLessThanThousand(thousand)} Thousand`);
  }
  if (remaining > 0) {
    const remStr = convertLessThanThousand(remaining);
    if (parts.length > 0) {
      parts.push(`And ${remStr}`);
    } else {
      parts.push(remStr);
    }
  }

  const result = parts.join(' ').replace(/\s+/g, ' ').trim();
  return result ? `${result} Only` : 'Zero Only';
}
