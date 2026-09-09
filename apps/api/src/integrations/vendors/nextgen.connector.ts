import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class NextGenConnector extends VendorConnectorBase {
  public override readonly provider = 'nextgen';
  protected override get displayName(){ return 'NextGen Healthcare'; }
  protected override get mrnPrefix(){ return 'NGRN'; }
  protected override get appointmentPrefix(){ return 'appt'; }
  protected override get patientPrefix(){ return 'Synthetic'; }
}
