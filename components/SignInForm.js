import { useState } from 'react';

// Options are alphabetical with "Other" always last
const BUILDINGS = [
  'Goodenough Hotel',
  'House 15',
  'London House',
  'William Goodenough House',
  'Other',
];

const CONTACTS = [
  'Arbaaz Nawab',
  'Dean Marsh',
  'Frankie Sheekey',
  'Laurel Anderson',
  'Other',
];

const COMPANIES = [
  'Barrier',
  'CMBS',
  'CMM Buildings',
  'Crest Lifts',
  'Florin',
  'Interim Pest Control',
  'Marshwell Firedoor',
  'Pacific Fire Alarms',
  'Pro-Door',
  'Southern Commercial Kitchen',
  'West End Decs',
  'Other',
];

const BLANK = {
  buildings:     [],
  buildingOther: '',
  contact:       '',
  contactOther:  '',
  company:       '',
  companyOther:  '',
  operativeName: '',
  contactNumber: '',
  idNumber:      '',
  rams:          '',
  ramsOther:     '',
  declaration:   false,
};

export default function SignInForm() {
  const [f, setF]           = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);

  function set(key, value) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function toggleBuilding(b) {
    setF((prev) => ({
      ...prev,
      buildings: prev.buildings.includes(b)
        ? prev.buildings.filter((x) => x !== b)
        : [...prev.buildings, b],
    }));
  }

  function validate() {
    if (f.buildings.length === 0)
      return 'Please select at least one building.';
    if (f.buildings.includes('Other') && !f.buildingOther.trim())
      return 'Please specify the building under "Other".';
    if (!f.contact)
      return 'Please select your point of contact.';
    if (f.contact === 'Other' && !f.contactOther.trim())
      return 'Please specify your point of contact.';
    if (!f.company)
      return 'Please select your company name.';
    if (f.company === 'Other' && !f.companyOther.trim())
      return 'Please specify your company name.';
    if (!f.operativeName.trim())
      return "Please enter the operative's full name.";
    if (!f.contactNumber.trim())
      return 'Please enter a contact number.';
    {
      const digits = f.contactNumber.trim().replace(/\s/g, '');
      if (!/^\d+$/.test(digits))
        return 'Contact number must contain digits only.';
      if (digits.startsWith('0')) {
        if (digits.length !== 11)
          return 'UK numbers starting with 0 must be 11 digits (e.g. 07700 900000).';
      } else {
        if (digits.length !== 10)
          return 'Contact number must be 10 digits.';
      }
    }
    if (!/^\d{3}$/.test(f.idNumber))
      return 'Contractor unique ID must be exactly three digits (e.g. 001).';
    if (!f.rams)
      return 'Please answer the RAMS question.';
    if (!f.declaration)
      return 'You must confirm the declaration before signing in.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);

    const err = validate();
    if (err) { setResult({ type: 'error', message: err }); return; }

    const buildingList   = f.buildings.map((b) => b === 'Other' ? f.buildingOther.trim() : b).join(', ');
    const contactDisplay = f.contact === 'Other' ? f.contactOther.trim() : f.contact;
    const companyDisplay = f.company === 'Other' ? f.companyOther.trim() : f.company;
    const ramsDisplay    = f.rams === 'Other' ? `Other – ${f.ramsOther.trim()}` : f.rams;

    setLoading(true);
    try {
      const res = await fetch('/api/signin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          companyName:          companyDisplay,
          operativeName:        f.operativeName.trim(),
          idNumber:             f.idNumber.trim(),
          buildings:            buildingList,
          pointOfContact:       contactDisplay,
          contactNumber:        f.contactNumber.trim(),
          ramsSubmitted:        ramsDisplay,
          declarationConfirmed: 'Yes',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult({ type: 'success', message: data.message });
        setF(BLANK);
      } else {
        setResult({ type: 'error', message: data.message });
      }
    } catch {
      setResult({ type: 'error', message: 'Network error. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {result && (
        <div className={`alert alert--${result.type === 'success' ? 'success' : 'error'}`}>
          {result.message}
        </div>
      )}

      <div className="card">
        <p className="card__title">Contractor Details</p>

        {/* Q3 — Company (shown first so it flows naturally) */}
        <div className="form-group">
          <label htmlFor="company">Company name *</label>
          <select id="company" value={f.company} onChange={(e) => set('company', e.target.value)}>
            <option value="">— Select company —</option>
            {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {f.company === 'Other' && (
            <input
              type="text"
              className="mt-2"
              value={f.companyOther}
              onChange={(e) => set('companyOther', e.target.value)}
              placeholder="Please specify your company…"
            />
          )}
        </div>

        {/* Q4 — Operative name */}
        <div className="form-group">
          <label htmlFor="operativeName">Operative's full name *</label>
          <input
            id="operativeName"
            type="text"
            value={f.operativeName}
            onChange={(e) => set('operativeName', e.target.value)}
            placeholder="e.g. John Smith"
            autoComplete="name"
          />
        </div>

        {/* Q5 — Contact number */}
        <div className="form-group">
          <label htmlFor="contactNumber">Contact number *</label>
          <input
            id="contactNumber"
            type="tel"
            value={f.contactNumber}
            onChange={(e) => set('contactNumber', e.target.value)}
            placeholder="e.g. 07700 900000"
            autoComplete="tel"
          />
        </div>

        {/* Q6 — Unique ID */}
        <div className="form-group">
          <label htmlFor="idNumber">
            Contractor unique ID *
            <span className="field-hint">Three-digit number printed on your ID card, e.g. 001</span>
          </label>
          <input
            id="idNumber"
            type="text"
            inputMode="numeric"
            value={f.idNumber}
            onChange={(e) => set('idNumber', e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="e.g. 001"
            maxLength={3}
            style={{ maxWidth: 120 }}
          />
        </div>
      </div>

      <div className="card">
        <p className="card__title">Site Information</p>

        {/* Q1 — Buildings (multiple choice) */}
        <div className="form-group">
          <label>
            Which building(s) are you working in today? *
            <span className="field-hint">Select all that apply</span>
          </label>
          <div className="checkbox-group">
            {BUILDINGS.map((b) => (
              <label key={b} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={f.buildings.includes(b)}
                  onChange={() => toggleBuilding(b)}
                />
                <span>{b}</span>
              </label>
            ))}
          </div>
          {f.buildings.includes('Other') && (
            <input
              type="text"
              className="mt-2"
              value={f.buildingOther}
              onChange={(e) => set('buildingOther', e.target.value)}
              placeholder="Please specify the building…"
            />
          )}
        </div>

        {/* Q2 — Point of contact */}
        <div className="form-group">
          <label htmlFor="contact">Point of contact *</label>
          <select id="contact" value={f.contact} onChange={(e) => set('contact', e.target.value)}>
            <option value="">— Select contact —</option>
            {CONTACTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {f.contact === 'Other' && (
            <input
              type="text"
              className="mt-2"
              value={f.contactOther}
              onChange={(e) => set('contactOther', e.target.value)}
              placeholder="Please specify…"
            />
          )}
        </div>
      </div>

      <div className="card">
        <p className="card__title">Health &amp; Safety</p>

        {/* Q7 — RAMS */}
        <div className="form-group">
          <label htmlFor="rams">Have you signed and submitted your RAMS? *</label>
          <select id="rams" value={f.rams} onChange={(e) => set('rams', e.target.value)}>
            <option value="">— Select —</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
            <option value="Other">Other</option>
          </select>
          {f.rams === 'Other' && (
            <textarea
              className="mt-2"
              rows={3}
              value={f.ramsOther ?? ''}
              onChange={(e) => set('ramsOther', e.target.value)}
              placeholder="Please provide details…"
              style={{ resize: 'vertical' }}
            />
          )}
        </div>

        {/* Q8 — Declaration */}
        <div className="form-group">
          <label style={{ marginBottom: 8 }}>Declaration *</label>
          <label className="checkbox-label checkbox-label--declaration">
            <input
              type="checkbox"
              checked={f.declaration}
              onChange={(e) => set('declaration', e.target.checked)}
            />
            <span>
              I confirm I am signing in/out accurately, and will return my contractor ID
              card when signing out. Failure to do so will result in delayed payments.
            </span>
          </label>
        </div>
      </div>

      <button type="submit" className="btn btn--primary" disabled={loading}>
        {loading && <span className="spinner" />}
        {loading ? 'Signing In…' : 'Sign In'}
      </button>
    </form>
  );
}
