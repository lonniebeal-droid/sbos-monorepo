import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class CernerConnector extends VendorConnectorBase {
  public override readonly provider = 'cerner';
  protected override get displayName(){ return 'Oracle Health / Cerner'; }
  protected override get mrnPrefix(){ return 'EMRN'; }
  protected override get appointmentPrefix(){ return 'appt'; }
  protected override get patientPrefix(){ return 'Synthetic'; }
}
