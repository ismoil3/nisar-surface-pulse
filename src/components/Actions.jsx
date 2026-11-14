import { t } from "../lib/i18n.jsx";

/** "What can people do with this?": one concrete use per audience (scientists, managers, decision-makers, educators / public). */
export default function Actions({ story }) {
  if (!story.actions?.length) return null;
  return (
    <>
      <h4 className="acts-title">{t("actTitle")}</h4>
      <ul className="future acts">
        {story.actions.map(([ic, who, x]) => <li key={who}><span aria-hidden="true">{ic}</span><div><b>{who}.</b> {x}</div></li>)}
      </ul>
    </>
  );
}
