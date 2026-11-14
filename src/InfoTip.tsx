import { useId } from 'react';

export function InfoTip({children}:{children:string}) {
 const id=useId();
 return <span className="info-tip"><button type="button" className="info-trigger" aria-label="More information" aria-describedby={id}>i</button><span className="info-popover" id={id} role="tooltip">{children}</span></span>;
}
