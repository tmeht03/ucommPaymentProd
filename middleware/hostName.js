function hostName () {
  let host = process.env.WEBSITE_HOSTNAME;
  const slot = process.env.WEBSITE_SLOT_NAME;
  const slotName = '-swap';

  if (slot === "Production" && host.includes(slotName)) {
    host = host.replace(new RegExp(slotName, 'g'), '');
  } else if (slot === 'swap' && !host.includes(slotName)) {
    const i = host.indexOf('.azurewebsites.net');
    host = host.slice(0,i) + slotName + host.slice(i);
  }
  return host;
}

module.exports = hostName;
