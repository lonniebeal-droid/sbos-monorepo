import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class AthenahealthConnector extends VendorConnectorBase {
  public override readonly provider = 'athenahealth';
  protected override get displayName(){ return 'athenahealth'; }
  protected override get mrnPrefix(){ return 'SRN'; }
  protected override get appointmentPrefix(){ return 'appt'; }
  protected override get patientPrefix(){ return 'Synthetic'; }
}
