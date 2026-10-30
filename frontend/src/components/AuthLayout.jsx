export default function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <section className="auth-shell" aria-label={title}>
      <div className="auth-hero" aria-hidden="true">
        <svg className="auth-illustration" viewBox="0 0 320 160" fill="none">
          <rect x="1" y="1" width="318" height="158" rx="20" fill="#F2F6FC" />
          <circle cx="257" cy="48" r="26" fill="#E4EDFA" />
          <circle className="auth-donut-ring" cx="257" cy="48" r="13" stroke="#3974BF" strokeWidth="6" />
          <path d="M257 35a13 13 0 0 1 13 13" stroke="#278B69" strokeWidth="6" strokeLinecap="round" />
          <rect x="43" y="24" width="112" height="118" rx="13" fill="#fff" stroke="#E5E6F1" strokeWidth="2" />
          <rect x="59" y="41" width="43" height="7" rx="3.5" fill="#D6E3F5" />
          <rect x="59" y="58" width="79" height="5" rx="2.5" fill="#E9EAF2" />
          <rect x="59" y="70" width="60" height="5" rx="2.5" fill="#E9EAF2" />
          <rect x="59" y="88" width="79" height="1" fill="#ECECF3" />
          <rect className="auth-chart-bar auth-chart-bar-one" x="59" y="98" width="22" height="25" rx="5" fill="#E5EDF9" />
          <rect className="auth-chart-bar auth-chart-bar-two" x="87" y="108" width="22" height="15" rx="5" fill="#B7CDEA" />
          <rect className="auth-chart-bar auth-chart-bar-three" x="115" y="95" width="22" height="28" rx="5" fill="#3974BF" />
          <rect x="174" y="83" width="108" height="51" rx="12" fill="#fff" stroke="#E5E6F1" strokeWidth="2" />
          <circle cx="193" cy="108" r="9" fill="#E7F5EF" />
          <g className="auth-checkmark">
            <path d="m189 108 3 3 6-7" stroke="#278B69" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <rect x="209" y="102" width="56" height="5" rx="2.5" fill="#DADBE7" />
          <rect x="209" y="112" width="38" height="4" rx="2" fill="#ECECF3" />
          <path d="M174 61h47" stroke="#D6E3F5" strokeWidth="2" strokeLinecap="round" />
          <circle cx="178" cy="61" r="4" fill="#3974BF" />
        </svg>
      </div>
      <div className="auth-brand">
        <span>ExpenseFlow</span>
      </div>
      <div className="auth-content">
        <div className="auth-form-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
