import React, { useState, useEffect } from 'react';
import { supabase, T, KATEGORIEN, SKILLS, getSkillLabel, getKat, getMedaille, getNextMedaille, getMedailleName, IMPRESSUM_TEXT, DATENSCHUTZ_TEXT, AGB_TEXT, formatDate, getGemeindeByPlz, isKlarname, isTerminNochNichtGestartet, isTerminAktuell } from '../core/shared';
import { Header, StelleCard, VereineListe, BottomBar, DatenschutzBox, Input, BigButton, Chip, InfoChip, SectionLabel, RoleCard, EmptyState, ErrorMsg } from '../components/ui';

function RechtlicheSeite({ title, text, onBack }) {
  return (
    <div>
      <Header title={title} onBack={onBack} />
      <div style={{ padding: "20px 20px 60px" }}>
        {text.split("\n\n").map((para, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            {para.split("\n").map((line, j) => (
              <div
                key={j}
                style={{
                  fontSize: j === 0 && para.includes("1.") ? 14 : 13,
                  fontWeight:
                    j === 0 && line.match(/^\d\./) ? "bold" : "normal",
                  color: j === 0 && line.match(/^\d\./) ? "#2C2416" : "#5C4A2A",
                  lineHeight: 1.7,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RechtlicheSeite;
